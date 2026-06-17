"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrityReportSchema = exports.ValidationResultSchema = exports.RepositionPlanSchema = exports.SurfacedSkillSchema = exports.RewrittenBulletSchema = exports.ChangeType = void 0;
const zod_1 = require("zod");
exports.ChangeType = zod_1.z.enum([
    'reworded',
    'reordered',
    'resummarised',
    'surfaced',
    'implied',
    'attested',
    'unchanged',
    'dropped',
]);
exports.RewrittenBulletSchema = zod_1.z.object({
    source_id: zod_1.z.string(),
    original: zod_1.z.string(),
    rewritten: zod_1.z.string(),
    change_type: exports.ChangeType,
    rationale: zod_1.z.string(),
    validated: zod_1.z.boolean().default(false),
});
exports.SurfacedSkillSchema = zod_1.z.object({
    skill_name: zod_1.z.string(),
    source_id: zod_1.z.string(),
    change_type: exports.ChangeType,
    implication_rule_id: zod_1.z.string().optional(),
});
exports.RepositionPlanSchema = zod_1.z.object({
    summary: zod_1.z.object({
        text: zod_1.z.string(),
        source_ids: zod_1.z.array(zod_1.z.string()),
        change_type: exports.ChangeType,
    }),
    experiences_order: zod_1.z.array(zod_1.z.string()),
    bullets: zod_1.z.array(exports.RewrittenBulletSchema),
    surfaced_skills: zod_1.z.array(exports.SurfacedSkillSchema),
    skills_order: zod_1.z.array(zod_1.z.string()),
    dropped: zod_1.z.array(zod_1.z.string()),
});
exports.ValidationResultSchema = zod_1.z.object({
    unit_id: zod_1.z.string(),
    result: zod_1.z.enum(['pass', 'fail']),
    reason: zod_1.z.string().optional(),
    rule_violated: zod_1.z.enum([
        'skill_not_in_inventory',
        'metric_invented',
        'proficiency_inflated',
        'semantic_inflation',
        'title_not_in_inventory',
    ]).optional(),
});
exports.IntegrityReportSchema = zod_1.z.object({
    results: zod_1.z.array(exports.ValidationResultSchema),
    ai_change_summary: zod_1.z.object({
        repositioned: zod_1.z.number(),
        reworded: zod_1.z.number(),
        surfaced: zod_1.z.number(),
        implied: zod_1.z.number(),
        fabricated: zod_1.z.number(),
    }),
    user_change_summary: zod_1.z.object({
        attested: zod_1.z.number(),
        edited: zod_1.z.number(),
    }),
});
//# sourceMappingURL=reposition-plan.schema.js.map