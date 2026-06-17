export interface ImplicationRule {
    id: string;
    antecedent: string;
    implies: string;
    note: string;
}
export declare const IMPLICATION_RULES: ImplicationRule[];
export declare function getImpliedSkills(inventorySkillNames: string[], rules?: ImplicationRule[]): Array<{
    implied: string;
    ruleId: string;
    antecedent: string;
}>;
