import { CandidateInventory } from '../schemas/inventory.schema';
import { RepositionPlan, IntegrityReport, ValidationResult } from '../schemas/reposition-plan.schema';
import { ImplicationRule } from '../allowlists/implications';
export declare class Validator {
    private readonly inventory;
    private readonly implicationRules;
    private readonly synonymLookup;
    private readonly permittedEntities;
    constructor(inventory: CandidateInventory, implicationRules?: ImplicationRule[]);
    validatePlan(plan: RepositionPlan): IntegrityReport;
    validateBullet(unitId: string, rewrittenText: string, sourceText: string | null): ValidationResult;
    validateSkill(skillName: string): ValidationResult;
    private checkEntityViolation;
    private checkNumericTokens;
    private checkProficiencyUpgrade;
    private findSourceText;
}
