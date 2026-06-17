import { z } from 'zod';
export declare const JobModelSchema: z.ZodObject<{
    title: z.ZodString;
    seniority: z.ZodEnum<["junior", "mid", "senior", "lead", "principal", "unknown"]>;
    must_have: z.ZodArray<z.ZodString, "many">;
    nice_to_have: z.ZodArray<z.ZodString, "many">;
    responsibilities: z.ZodArray<z.ZodString, "many">;
    ats_keywords: z.ZodArray<z.ZodString, "many">;
    soft_signals: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    title: string;
    seniority: "unknown" | "junior" | "mid" | "senior" | "lead" | "principal";
    must_have: string[];
    nice_to_have: string[];
    responsibilities: string[];
    ats_keywords: string[];
    soft_signals: string[];
}, {
    title: string;
    seniority: "unknown" | "junior" | "mid" | "senior" | "lead" | "principal";
    must_have: string[];
    nice_to_have: string[];
    responsibilities: string[];
    ats_keywords: string[];
    soft_signals: string[];
}>;
export type JobModel = z.infer<typeof JobModelSchema>;
export declare const RequirementCoverageSchema: z.ZodObject<{
    requirement: z.ZodString;
    bucket: z.ZodEnum<["covered", "latent", "gap"]>;
    source_ids: z.ZodArray<z.ZodString, "many">;
    match_rule: z.ZodEnum<["exact", "synonym", "implication", "semantic", "none"]>;
    implication_antecedent: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    requirement: string;
    bucket: "covered" | "latent" | "gap";
    source_ids: string[];
    match_rule: "exact" | "none" | "synonym" | "implication" | "semantic";
    implication_antecedent?: string | undefined;
}, {
    requirement: string;
    bucket: "covered" | "latent" | "gap";
    source_ids: string[];
    match_rule: "exact" | "none" | "synonym" | "implication" | "semantic";
    implication_antecedent?: string | undefined;
}>;
export declare const MatchReportSchema: z.ZodObject<{
    must_have: z.ZodArray<z.ZodObject<{
        requirement: z.ZodString;
        bucket: z.ZodEnum<["covered", "latent", "gap"]>;
        source_ids: z.ZodArray<z.ZodString, "many">;
        match_rule: z.ZodEnum<["exact", "synonym", "implication", "semantic", "none"]>;
        implication_antecedent: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        requirement: string;
        bucket: "covered" | "latent" | "gap";
        source_ids: string[];
        match_rule: "exact" | "none" | "synonym" | "implication" | "semantic";
        implication_antecedent?: string | undefined;
    }, {
        requirement: string;
        bucket: "covered" | "latent" | "gap";
        source_ids: string[];
        match_rule: "exact" | "none" | "synonym" | "implication" | "semantic";
        implication_antecedent?: string | undefined;
    }>, "many">;
    nice_to_have: z.ZodArray<z.ZodObject<{
        requirement: z.ZodString;
        bucket: z.ZodEnum<["covered", "latent", "gap"]>;
        source_ids: z.ZodArray<z.ZodString, "many">;
        match_rule: z.ZodEnum<["exact", "synonym", "implication", "semantic", "none"]>;
        implication_antecedent: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        requirement: string;
        bucket: "covered" | "latent" | "gap";
        source_ids: string[];
        match_rule: "exact" | "none" | "synonym" | "implication" | "semantic";
        implication_antecedent?: string | undefined;
    }, {
        requirement: string;
        bucket: "covered" | "latent" | "gap";
        source_ids: string[];
        match_rule: "exact" | "none" | "synonym" | "implication" | "semantic";
        implication_antecedent?: string | undefined;
    }>, "many">;
    match_score: z.ZodNumber;
    gaps: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    must_have: {
        requirement: string;
        bucket: "covered" | "latent" | "gap";
        source_ids: string[];
        match_rule: "exact" | "none" | "synonym" | "implication" | "semantic";
        implication_antecedent?: string | undefined;
    }[];
    nice_to_have: {
        requirement: string;
        bucket: "covered" | "latent" | "gap";
        source_ids: string[];
        match_rule: "exact" | "none" | "synonym" | "implication" | "semantic";
        implication_antecedent?: string | undefined;
    }[];
    match_score: number;
    gaps: string[];
}, {
    must_have: {
        requirement: string;
        bucket: "covered" | "latent" | "gap";
        source_ids: string[];
        match_rule: "exact" | "none" | "synonym" | "implication" | "semantic";
        implication_antecedent?: string | undefined;
    }[];
    nice_to_have: {
        requirement: string;
        bucket: "covered" | "latent" | "gap";
        source_ids: string[];
        match_rule: "exact" | "none" | "synonym" | "implication" | "semantic";
        implication_antecedent?: string | undefined;
    }[];
    match_score: number;
    gaps: string[];
}>;
export type RequirementCoverage = z.infer<typeof RequirementCoverageSchema>;
export type MatchReport = z.infer<typeof MatchReportSchema>;
