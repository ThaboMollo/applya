"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Validator = void 0;
const synonyms_1 = require("../allowlists/synonyms");
const implications_1 = require("../allowlists/implications");
class Validator {
    constructor(inventory, implicationRules = implications_1.IMPLICATION_RULES) {
        this.inventory = inventory;
        this.implicationRules = implicationRules;
        this.synonymLookup = (0, synonyms_1.buildSynonymLookup)();
        const rawEntityNames = [
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
        const canonicalInventoryEntities = rawEntityNames.map((n) => (0, synonyms_1.resolveCanonical)(n, this.synonymLookup).toLowerCase());
        const implied = (0, implications_1.getImpliedSkills)(rawEntityNames, implicationRules);
        const impliedCanonicals = implied.map((i) => i.implied.toLowerCase());
        const attestedCanonicals = inventory.skills
            .filter((s) => s.origin === 'attested')
            .map((s) => (0, synonyms_1.resolveCanonical)(s.name, this.synonymLookup).toLowerCase());
        this.permittedEntities = new Set([
            ...canonicalInventoryEntities,
            ...impliedCanonicals,
            ...attestedCanonicals,
        ]);
    }
    validatePlan(plan) {
        const results = [];
        let fabricated = 0;
        for (const bullet of plan.bullets) {
            const sourceText = this.findSourceText(bullet.source_id);
            const result = this.validateBullet(bullet.source_id, bullet.rewritten, sourceText);
            results.push(result);
            if (result.result === 'fail')
                fabricated++;
        }
        for (const surfaced of plan.surfaced_skills) {
            const result = this.validateSkill(surfaced.skill_name);
            results.push({ ...result, unit_id: surfaced.skill_name });
            if (result.result === 'fail')
                fabricated++;
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
                    this.inventory.experiences
                        .flatMap((e) => e.bullets)
                        .filter((b) => b.origin === 'edited').length,
            },
        };
    }
    validateBullet(unitId, rewrittenText, sourceText) {
        const numericViolation = this.checkNumericTokens(rewrittenText, sourceText ?? '');
        if (numericViolation) {
            return { unit_id: unitId, result: 'fail', reason: numericViolation, rule_violated: 'metric_invented' };
        }
        const proficiencyViolation = this.checkProficiencyUpgrade(rewrittenText, sourceText ?? '');
        if (proficiencyViolation) {
            return { unit_id: unitId, result: 'fail', reason: proficiencyViolation, rule_violated: 'proficiency_inflated' };
        }
        const entityViolation = this.checkEntityViolation(rewrittenText);
        if (entityViolation) {
            return { unit_id: unitId, result: 'fail', reason: entityViolation, rule_violated: 'skill_not_in_inventory' };
        }
        return { unit_id: unitId, result: 'pass' };
    }
    validateSkill(skillName) {
        const canonical = (0, synonyms_1.resolveCanonical)(skillName, this.synonymLookup);
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
    checkEntityViolation(rewrittenText) {
        const permittedChecked = new Set();
        for (const [aliasLower, canonical] of this.synonymLookup) {
            const canonicalLower = canonical.toLowerCase();
            if (this.permittedEntities.has(canonicalLower)) {
                permittedChecked.add(canonicalLower);
                continue;
            }
            if (permittedChecked.has(canonicalLower))
                continue;
            const escaped = aliasLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            try {
                const regex = new RegExp(`(?<![a-zA-Z0-9._\\-])${escaped}(?![a-zA-Z0-9._\\-])`, 'i');
                if (regex.test(rewrittenText)) {
                    return `"${canonical}" appears in rewrite but is not in the candidate inventory, a curated implication, or user-attested`;
                }
            }
            catch {
            }
        }
        return null;
    }
    checkNumericTokens(rewrite, source) {
        const numericPattern = /\b\d[\d,.]*%?/g;
        const rewriteNumbers = rewrite.match(numericPattern) ?? [];
        for (const num of rewriteNumbers) {
            if (!source.includes(num)) {
                return `Metric "${num}" appears in rewrite but not in source text — potential fabrication`;
            }
        }
        return null;
    }
    checkProficiencyUpgrade(rewrite, source) {
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
    findSourceText(sourceId) {
        for (const exp of this.inventory.experiences) {
            const bullet = exp.bullets.find((b) => b.id === sourceId);
            if (bullet)
                return bullet.text;
        }
        for (const proj of this.inventory.projects) {
            const bullet = proj.bullets.find((b) => b.id === sourceId);
            if (bullet)
                return bullet.text;
        }
        return null;
    }
}
exports.Validator = Validator;
//# sourceMappingURL=index.js.map