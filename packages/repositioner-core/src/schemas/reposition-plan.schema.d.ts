import { z } from 'zod';
export declare const ChangeType: z.ZodEnum<["reworded", "reordered", "resummarised", "surfaced", "implied", "attested", "unchanged", "dropped"]>;
export declare const RewrittenBulletSchema: z.ZodObject<{
    source_id: z.ZodString;
    original: z.ZodString;
    rewritten: z.ZodString;
    change_type: z.ZodEnum<["reworded", "reordered", "resummarised", "surfaced", "implied", "attested", "unchanged", "dropped"]>;
    rationale: z.ZodString;
    validated: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    source_id: string;
    original: string;
    rewritten: string;
    change_type: "attested" | "reworded" | "reordered" | "resummarised" | "surfaced" | "implied" | "unchanged" | "dropped";
    rationale: string;
    validated: boolean;
}, {
    source_id: string;
    original: string;
    rewritten: string;
    change_type: "attested" | "reworded" | "reordered" | "resummarised" | "surfaced" | "implied" | "unchanged" | "dropped";
    rationale: string;
    validated?: boolean | undefined;
}>;
export declare const SurfacedSkillSchema: z.ZodObject<{
    skill_name: z.ZodString;
    source_id: z.ZodString;
    change_type: z.ZodEnum<["reworded", "reordered", "resummarised", "surfaced", "implied", "attested", "unchanged", "dropped"]>;
    implication_rule_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    source_id: string;
    change_type: "attested" | "reworded" | "reordered" | "resummarised" | "surfaced" | "implied" | "unchanged" | "dropped";
    skill_name: string;
    implication_rule_id?: string | undefined;
}, {
    source_id: string;
    change_type: "attested" | "reworded" | "reordered" | "resummarised" | "surfaced" | "implied" | "unchanged" | "dropped";
    skill_name: string;
    implication_rule_id?: string | undefined;
}>;
export declare const RepositionPlanSchema: z.ZodObject<{
    summary: z.ZodObject<{
        text: z.ZodString;
        source_ids: z.ZodArray<z.ZodString, "many">;
        change_type: z.ZodEnum<["reworded", "reordered", "resummarised", "surfaced", "implied", "attested", "unchanged", "dropped"]>;
    }, "strip", z.ZodTypeAny, {
        text: string;
        source_ids: string[];
        change_type: "attested" | "reworded" | "reordered" | "resummarised" | "surfaced" | "implied" | "unchanged" | "dropped";
    }, {
        text: string;
        source_ids: string[];
        change_type: "attested" | "reworded" | "reordered" | "resummarised" | "surfaced" | "implied" | "unchanged" | "dropped";
    }>;
    experiences_order: z.ZodArray<z.ZodString, "many">;
    bullets: z.ZodArray<z.ZodObject<{
        source_id: z.ZodString;
        original: z.ZodString;
        rewritten: z.ZodString;
        change_type: z.ZodEnum<["reworded", "reordered", "resummarised", "surfaced", "implied", "attested", "unchanged", "dropped"]>;
        rationale: z.ZodString;
        validated: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        source_id: string;
        original: string;
        rewritten: string;
        change_type: "attested" | "reworded" | "reordered" | "resummarised" | "surfaced" | "implied" | "unchanged" | "dropped";
        rationale: string;
        validated: boolean;
    }, {
        source_id: string;
        original: string;
        rewritten: string;
        change_type: "attested" | "reworded" | "reordered" | "resummarised" | "surfaced" | "implied" | "unchanged" | "dropped";
        rationale: string;
        validated?: boolean | undefined;
    }>, "many">;
    surfaced_skills: z.ZodArray<z.ZodObject<{
        skill_name: z.ZodString;
        source_id: z.ZodString;
        change_type: z.ZodEnum<["reworded", "reordered", "resummarised", "surfaced", "implied", "attested", "unchanged", "dropped"]>;
        implication_rule_id: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        source_id: string;
        change_type: "attested" | "reworded" | "reordered" | "resummarised" | "surfaced" | "implied" | "unchanged" | "dropped";
        skill_name: string;
        implication_rule_id?: string | undefined;
    }, {
        source_id: string;
        change_type: "attested" | "reworded" | "reordered" | "resummarised" | "surfaced" | "implied" | "unchanged" | "dropped";
        skill_name: string;
        implication_rule_id?: string | undefined;
    }>, "many">;
    skills_order: z.ZodArray<z.ZodString, "many">;
    dropped: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    bullets: {
        source_id: string;
        original: string;
        rewritten: string;
        change_type: "attested" | "reworded" | "reordered" | "resummarised" | "surfaced" | "implied" | "unchanged" | "dropped";
        rationale: string;
        validated: boolean;
    }[];
    dropped: string[];
    summary: {
        text: string;
        source_ids: string[];
        change_type: "attested" | "reworded" | "reordered" | "resummarised" | "surfaced" | "implied" | "unchanged" | "dropped";
    };
    experiences_order: string[];
    surfaced_skills: {
        source_id: string;
        change_type: "attested" | "reworded" | "reordered" | "resummarised" | "surfaced" | "implied" | "unchanged" | "dropped";
        skill_name: string;
        implication_rule_id?: string | undefined;
    }[];
    skills_order: string[];
}, {
    bullets: {
        source_id: string;
        original: string;
        rewritten: string;
        change_type: "attested" | "reworded" | "reordered" | "resummarised" | "surfaced" | "implied" | "unchanged" | "dropped";
        rationale: string;
        validated?: boolean | undefined;
    }[];
    dropped: string[];
    summary: {
        text: string;
        source_ids: string[];
        change_type: "attested" | "reworded" | "reordered" | "resummarised" | "surfaced" | "implied" | "unchanged" | "dropped";
    };
    experiences_order: string[];
    surfaced_skills: {
        source_id: string;
        change_type: "attested" | "reworded" | "reordered" | "resummarised" | "surfaced" | "implied" | "unchanged" | "dropped";
        skill_name: string;
        implication_rule_id?: string | undefined;
    }[];
    skills_order: string[];
}>;
export declare const ValidationResultSchema: z.ZodObject<{
    unit_id: z.ZodString;
    result: z.ZodEnum<["pass", "fail"]>;
    reason: z.ZodOptional<z.ZodString>;
    rule_violated: z.ZodOptional<z.ZodEnum<["skill_not_in_inventory", "metric_invented", "proficiency_inflated", "semantic_inflation", "title_not_in_inventory"]>>;
}, "strip", z.ZodTypeAny, {
    result: "pass" | "fail";
    unit_id: string;
    reason?: string | undefined;
    rule_violated?: "skill_not_in_inventory" | "metric_invented" | "proficiency_inflated" | "semantic_inflation" | "title_not_in_inventory" | undefined;
}, {
    result: "pass" | "fail";
    unit_id: string;
    reason?: string | undefined;
    rule_violated?: "skill_not_in_inventory" | "metric_invented" | "proficiency_inflated" | "semantic_inflation" | "title_not_in_inventory" | undefined;
}>;
export declare const IntegrityReportSchema: z.ZodObject<{
    results: z.ZodArray<z.ZodObject<{
        unit_id: z.ZodString;
        result: z.ZodEnum<["pass", "fail"]>;
        reason: z.ZodOptional<z.ZodString>;
        rule_violated: z.ZodOptional<z.ZodEnum<["skill_not_in_inventory", "metric_invented", "proficiency_inflated", "semantic_inflation", "title_not_in_inventory"]>>;
    }, "strip", z.ZodTypeAny, {
        result: "pass" | "fail";
        unit_id: string;
        reason?: string | undefined;
        rule_violated?: "skill_not_in_inventory" | "metric_invented" | "proficiency_inflated" | "semantic_inflation" | "title_not_in_inventory" | undefined;
    }, {
        result: "pass" | "fail";
        unit_id: string;
        reason?: string | undefined;
        rule_violated?: "skill_not_in_inventory" | "metric_invented" | "proficiency_inflated" | "semantic_inflation" | "title_not_in_inventory" | undefined;
    }>, "many">;
    ai_change_summary: z.ZodObject<{
        repositioned: z.ZodNumber;
        reworded: z.ZodNumber;
        surfaced: z.ZodNumber;
        implied: z.ZodNumber;
        fabricated: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        reworded: number;
        surfaced: number;
        implied: number;
        repositioned: number;
        fabricated: number;
    }, {
        reworded: number;
        surfaced: number;
        implied: number;
        repositioned: number;
        fabricated: number;
    }>;
    user_change_summary: z.ZodObject<{
        attested: z.ZodNumber;
        edited: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        attested: number;
        edited: number;
    }, {
        attested: number;
        edited: number;
    }>;
}, "strip", z.ZodTypeAny, {
    results: {
        result: "pass" | "fail";
        unit_id: string;
        reason?: string | undefined;
        rule_violated?: "skill_not_in_inventory" | "metric_invented" | "proficiency_inflated" | "semantic_inflation" | "title_not_in_inventory" | undefined;
    }[];
    ai_change_summary: {
        reworded: number;
        surfaced: number;
        implied: number;
        repositioned: number;
        fabricated: number;
    };
    user_change_summary: {
        attested: number;
        edited: number;
    };
}, {
    results: {
        result: "pass" | "fail";
        unit_id: string;
        reason?: string | undefined;
        rule_violated?: "skill_not_in_inventory" | "metric_invented" | "proficiency_inflated" | "semantic_inflation" | "title_not_in_inventory" | undefined;
    }[];
    ai_change_summary: {
        reworded: number;
        surfaced: number;
        implied: number;
        repositioned: number;
        fabricated: number;
    };
    user_change_summary: {
        attested: number;
        edited: number;
    };
}>;
export type ChangeType = z.infer<typeof ChangeType>;
export type RewrittenBullet = z.infer<typeof RewrittenBulletSchema>;
export type SurfacedSkill = z.infer<typeof SurfacedSkillSchema>;
export type RepositionPlan = z.infer<typeof RepositionPlanSchema>;
export type ValidationResult = z.infer<typeof ValidationResultSchema>;
export type IntegrityReport = z.infer<typeof IntegrityReportSchema>;
