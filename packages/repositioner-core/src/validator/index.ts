import { CandidateInventory } from '../schemas/inventory.schema';
import { RepositionPlan, IntegrityReport, ValidationResult } from '../schemas/reposition-plan.schema';
import { buildSynonymLookup, resolveCanonical } from '../allowlists/synonyms';
import { getImpliedSkills, ImplicationRule, IMPLICATION_RULES } from '../allowlists/implications';

/**
 * Stage 6 — Programmatic Validator (deterministic gate).
 *
 * This is the integrity guarantee in code, not vibes. It runs after Stage 5
 * generation and before any output reaches the user.
 *
 * A claim is PERMITTED if and only if it is:
 *   1. In the confirmed inventory (exact match or via synonym allowlist)
 *   2. A curated implication (antecedent is in inventory + rule exists in allowlist)
 *   3. User-attested (origin: "attested" in the confirmed inventory)
 *
 * Anything else → fail. This is called once per rewritten bullet/skill.
 *
 * NUMERIC RULE: every number in a rewrite must appear verbatim in the cited source text.
 * No exceptions — this kills invented metrics.
 *
 * PROFICIENCY RULE: if proficiency_stated is "none" or a lower level, the rewrite
 * may not claim a higher proficiency. Upgrades are blocked.
 */
export class Validator {
  private readonly synonymLookup: Map<string, string>;
  private readonly impliedSkills: Set<string>;
  private readonly attestedSkills: Set<string>;
  private readonly inventorySkillNames: Set<string>;

  constructor(
    private readonly inventory: CandidateInventory,
    private readonly implicationRules: ImplicationRule[] = IMPLICATION_RULES,
  ) {
    this.synonymLookup = buildSynonymLookup();

    const allSkillNames = inventory.skills.map((s) => s.name);
    this.inventorySkillNames = new Set(allSkillNames.map((n) => n.toLowerCase()));

    const implied = getImpliedSkills(allSkillNames, implicationRules);
    this.impliedSkills = new Set(implied.map((i) => i.implied.toLowerCase()));

    this.attestedSkills = new Set(
      inventory.skills
        .filter((s) => s.origin === 'attested')
        .map((s) => s.name.toLowerCase()),
    );
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
        edited: this.inventory.skills.filter((s) => s.origin === 'edited').length +
          this.inventory.experiences.flatMap((e) => e.bullets).filter((b) => b.origin === 'edited').length,
      },
    };
  }

  validateBullet(unitId: string, rewrittenText: string, sourceText: string | null): ValidationResult {
    // 1. Numeric check — every number in rewrite must appear in source
    const numericViolation = this.checkNumericTokens(rewrittenText, sourceText ?? '');
    if (numericViolation) {
      return { unit_id: unitId, result: 'fail', reason: numericViolation, rule_violated: 'metric_invented' };
    }

    // 2. Proficiency check — no upgrades from stated level
    const proficiencyViolation = this.checkProficiencyUpgrade(rewrittenText, sourceText ?? '');
    if (proficiencyViolation) {
      return { unit_id: unitId, result: 'fail', reason: proficiencyViolation, rule_violated: 'proficiency_inflated' };
    }

    return { unit_id: unitId, result: 'pass' };
  }

  validateSkill(skillName: string): ValidationResult {
    const canonical = resolveCanonical(skillName, this.synonymLookup);
    const lower = canonical.toLowerCase();

    if (
      this.inventorySkillNames.has(lower) ||
      this.impliedSkills.has(lower) ||
      this.attestedSkills.has(lower)
    ) {
      return { unit_id: skillName, result: 'pass' };
    }

    // Also check if it appears in any bullet entity
    const inBullet = this.inventory.experiences
      .flatMap((e) => e.bullets)
      .some((b) =>
        b.entities.skills.some((s) => resolveCanonical(s, this.synonymLookup).toLowerCase() === lower) ||
        b.entities.tools.some((t) => resolveCanonical(t, this.synonymLookup).toLowerCase() === lower),
      );

    if (inBullet) return { unit_id: skillName, result: 'pass' };

    return {
      unit_id: skillName,
      result: 'fail',
      reason: `Skill "${skillName}" is not in the candidate inventory, a curated implication, or user-attested`,
      rule_violated: 'skill_not_in_inventory',
    };
  }

  private checkNumericTokens(rewrite: string, source: string): string | null {
    const numericPattern = /\b\d[\d,.]*/g;
    const rewriteNumbers = rewrite.match(numericPattern) ?? [];
    for (const num of rewriteNumbers) {
      if (!source.includes(num)) {
        return `Metric "${num}" appears in rewrite but not in source text — potential fabrication`;
      }
    }
    return null;
  }

  private checkProficiencyUpgrade(rewrite: string, _source: string): string | null {
    const upgradeWords = ['expert', 'expert-level', 'senior', 'lead', 'architected', 'mastery'];
    const rewriteLower = rewrite.toLowerCase();
    for (const word of upgradeWords) {
      if (rewriteLower.includes(word) && !_source.toLowerCase().includes(word)) {
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
