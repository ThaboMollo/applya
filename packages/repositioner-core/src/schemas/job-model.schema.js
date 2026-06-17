"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchReportSchema = exports.RequirementCoverageSchema = exports.JobModelSchema = void 0;
const zod_1 = require("zod");
exports.JobModelSchema = zod_1.z.object({
    title: zod_1.z.string(),
    seniority: zod_1.z.enum(['junior', 'mid', 'senior', 'lead', 'principal', 'unknown']),
    must_have: zod_1.z.array(zod_1.z.string()),
    nice_to_have: zod_1.z.array(zod_1.z.string()),
    responsibilities: zod_1.z.array(zod_1.z.string()),
    ats_keywords: zod_1.z.array(zod_1.z.string()),
    soft_signals: zod_1.z.array(zod_1.z.string()),
});
exports.RequirementCoverageSchema = zod_1.z.object({
    requirement: zod_1.z.string(),
    bucket: zod_1.z.enum(['covered', 'latent', 'gap']),
    source_ids: zod_1.z.array(zod_1.z.string()),
    match_rule: zod_1.z.enum(['exact', 'synonym', 'implication', 'semantic', 'none']),
    implication_antecedent: zod_1.z.string().optional(),
});
exports.MatchReportSchema = zod_1.z.object({
    must_have: zod_1.z.array(exports.RequirementCoverageSchema),
    nice_to_have: zod_1.z.array(exports.RequirementCoverageSchema),
    match_score: zod_1.z.number().min(0).max(100),
    gaps: zod_1.z.array(zod_1.z.string()),
});
//# sourceMappingURL=job-model.schema.js.map