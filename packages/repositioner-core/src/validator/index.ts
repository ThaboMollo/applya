import { CandidateInventory } from '../schemas/inventory.schema';
import { RepositionPlan, IntegrityReport, ValidationResult } from '../schemas/reposition-plan.schema';
import { buildSynonymLookup, resolveCanonical } from '../allowlists/synonyms';
import { getImpliedSkills, ImplicationRule, IMPLICATION_RULES } from '../allowlists/implications';

/**
 * Stage 6 — Programmatic Validator (deterministic gate).
 *
 * A claim is PERMITTED iff it is:
 *   1. In the confirmed inventory (exact or via synonym allowlist)
 *   2. A curated implication (antecedent present + rule in allowlist)
 *   3. User-attested (origin: "attested" in the confirmed inventory)
 *
 * Anything else → fail. Runs after Stage 5, before output reaches the user.
 *
 * NUMERIC RULE: every number in a rewrite must appear verbatim in the cited source text.
 * PROFICIENCY RULE: rewrite may not claim higher proficiency than source states.
 * ENTITY RULE: known tech terms (from synonym allowlist) not in the permitted set → fail.
 */
export class Validator {
  private readonly synonymLookup: Map<string, string>;
  /** All permitted entity names (canonical, lowercase) */
  private readonly permittedEntities: Set<string>;

  constructor(
    private readonly inventory: CandidateInventory,
    private readonly implicationRules: ImplicationRule[] = IMPLICATION_RULES,
  ) {
    this.synonymLookup = buildSynonymLookup();

    // Collect all raw entity names from inventory — skills section + bullet entities
    const rawEntityNames: string[] = [
      ...inventory.skills.map((s) => s.name),
      ...inventory.experiences.flatMap((e) => e.bullets).flatMap((b) => [
        ...b.entities.skills,
        ...b.entities.tools,
      ]),
      ...inventory.projects.flatMap((p) => p.bullets).flatMap((b) => [
        ...b.entities.skills,
        ...b.entities.tools,
      ]),
    ];

    // Resolve all to canonical form
    const canonicalInventoryEntities = rawEntityNames.map((n) =>
      resolveCanonical(n, this.synonymLookup).toLowerCase(),
    );

    // Skills implied by inventory via curated rules
    const implied = getImpliedSkills(rawEntityNames, implicationRules);
    const impliedCanonicals = implied.map((i) => i.implied.toLowerCase());

    // User-attested skills
    const attestedCanonicals = inventory.skills
      .filter((s) => s.origin === 'attested')
      .map((s) => resolveCanonical(s.name, this.synonymLookup).toLowerCase());

    this.permittedEntities = new Set([
      ...canonicalInventoryEntities,
      ...impliedCanonicals,
      ...attestedCanonicals,
    ]);
  }

  validatePlan(plan: RepositionPlan): IntegrityReport {
    const results: ValidationResult[] = [];
    let fabricated = 0;

    for (const bullet of plan.bullets) {
      const sourceText = this.findSourceText(bullet.source_id);
      const result = this.validateBullet(bullet.source_id, bullet.rewritten, sourceText);
      results.push(result);
      if (result.result === 'fail') fabricated++;
    }

    for (const surfaced of plan.surfaced_skills) {
      const result = this.validateSkill(surfaced.skill_name);
      results.push({ ...result, unit_id: surfaced.skill_name });
      if (result.result === 'fail') fabricated++;
    }

    return {
      results,
      ai_change_summary: {
        repositioned: plan.experiences_order.length,
        reworded: plan.bullets.filter((b) => b.change_type === 'reworded').length,
        surfaced: plan.surfaced_skills.filter((s) => s.change_type === 'surfaced').length,
        implied: plan.surfaced_skills.filter((s) => s.change_type === 'implied').length,
        fabricated,
      },
      user_change_summary: {
        attested: this.inventory.skills.filter((s) => s.origin === 'attested').length,
        edited:
          this.inventory.skills.filter((s) => s.origin === 'edited').length +
          this.inventory.experiences
            .flatMap((e) => e.bullets)
            .filter((b) => b.origin === 'edited').length,
      },
    };
  }

  validateBullet(unitId: string, rewrittenText: string, sourceText: string | null): ValidationResult {
    // 1. Numeric check — every number in rewrite must appear verbatim in source
    const numericViolation = this.checkNumericTokens(rewrittenText, sourceText ?? '');
    if (numericViolation) {
      return { unit_id: unitId, result: 'fail', reason: numericViolation, rule_violated: 'metric_invented' };
    }

    // 2. Proficiency check — no upgrades from stated level
    const proficiencyViolation = this.checkProficiencyUpgrade(rewrittenText, sourceText ?? '');
    if (proficiencyViolation) {
      return { unit_id: unitId, result: 'fail', reason: proficiencyViolation, rule_violated: 'proficiency_inflated' };
    }

    // 3. Entity check — known tech terms from the synonym allowlist not in permitted set → fail
    const entityViolation = this.checkEntityViolation(rewrittenText);
    if (entityViolation) {
      return { unit_id: unitId, result: 'fail', reason: entityViolation, rule_violated: 'skill_not_in_inventory' };
    }

    return { unit_id: unitId, result: 'pass' };
  }

  validateSkill(skillName: string): ValidationResult {
    const canonical = resolveCanonical(skillName, this.synonymLookup);
    const lower = canonical.toLowerCase();

    if (this.permittedEntities.has(lower)) {
      return { unit_id: skillName, result: 'pass' };
    }

    return {
      unit_id: skillName,
      result: 'fail',
      reason: `Skill "${skillName}" is not in the candidate inventory, a curated implication, or user-attested`,
      rule_violated: 'skill_not_in_inventory',
    };
  }

  /**
   * Check if any known tech term (from the synonym allowlist) appears in the rewritten text
   * but is NOT in the permitted entity set. This catches skills the model introduced that
   * were never in the candidate's resume.
   *
   * Coverage: terms in our synonym allowlist only. Terms not in the list may slip through
   * to Stage 7 (LLM judge). This is by design — Stage 6 is deterministic and auditable.
   */
  private checkEntityViolation(rewrittenText: string): string | null {
    // Skip permitted canonicals to avoid redundant checks across their aliases.
    // For non-permitted canonicals, EVERY alias must be tested — the canonical form
    // ("kubernetes") might not appear in the text, but an alias ("k8s") might.
    const permittedChecked = new Set<string>();

    for (const [aliasLower, canonical] of this.synonymLookup) {
      const canonicalLower = canonical.toLowerCase();

      // If this canonical is permitted, mark it and skip all its aliases
      if (this.permittedEntities.has(canonicalLower)) {
        permittedChecked.add(canonicalLower);
        continue;
      }
      if (permittedChecked.has(canonicalLower)) continue;

      // Term is NOT permitted — does this alias appear in the rewrite?
      const escaped = aliasLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      try {
        // Treat . _ - as word-internal separators so "JS" doesn't match ".js" in "React.js"
        const regex = new RegExp(`(?<![a-zA-Z0-9._\\-])${escaped}(?![a-zA-Z0-9._\\-])`, 'i');
        if (regex.test(rewrittenText)) {
          return `"${canonical}" appears in rewrite but is not in the candidate inventory, a curated implication, or user-attested`;
        }
      } catch {
        // Skip terms that produce invalid regex after escaping (edge case)
      }
    }

    return null;
  }

  private checkNumericTokens(rewrite: string, source: string): string | null {
    const numericPattern = /\b\d[\d,.]*%?/g;
    const rewriteNumbers = rewrite.match(numericPattern) ?? [];
    for (const num of rewriteNumbers) {
      if (!source.includes(num)) {
        return `Metric "${num}" appears in rewrite but not in source text — potential fabrication`;
      }
    }
    return null;
  }

  private checkProficiencyUpgrade(rewrite: string, source: string): string | null {
    const upgradeWords = ['expert', 'expert-level', 'architected', 'mastery', 'principal'];
    const rewriteLower = rewrite.toLowerCase();
    const sourceLower = source.toLowerCase();
    for (const word of upgradeWords) {
      if (rewriteLower.includes(word) && !sourceLower.includes(word)) {
        return `Proficiency term "${word}" in rewrite is not supported by source text`;
      }
    }
    return null;
  }

  private findSourceText(sourceId: string): string | null {
    for (const exp of this.inventory.experiences) {
      const bullet = exp.bullets.find((b) => b.id === sourceId);
      if (bullet) return bullet.text;
    }
    for (const proj of this.inventory.projects) {
      const bullet = proj.bullets.find((b) => b.id === sourceId);
      if (bullet) return bullet.text;
    }
    return null;
  }
}
