"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CandidateInventorySchema = exports.ContactSchema = exports.CertificationSchema = exports.EducationSchema = exports.ProjectSchema = exports.SkillSchema = exports.ExperienceSchema = exports.BulletSchema = exports.EntitySchema = void 0;
const zod_1 = require("zod");
const ItemOrigin = zod_1.z.enum(['extracted', 'attested', 'edited']);
exports.EntitySchema = zod_1.z.object({
    skills: zod_1.z.array(zod_1.z.string()),
    tools: zod_1.z.array(zod_1.z.string()),
    metrics: zod_1.z.array(zod_1.z.string()),
    actions: zod_1.z.array(zod_1.z.string()),
});
exports.BulletSchema = zod_1.z.object({
    id: zod_1.z.string(),
    text: zod_1.z.string(),
    entities: exports.EntitySchema,
    confidence: zod_1.z.number().min(0).max(1).optional(),
    origin: ItemOrigin.default('extracted'),
});
exports.ExperienceSchema = zod_1.z.object({
    id: zod_1.z.string(),
    company: zod_1.z.string(),
    title: zod_1.z.string(),
    start: zod_1.z.string().regex(/^\d{4}-\d{2}$/, 'YYYY-MM'),
    end: zod_1.z.string().regex(/^\d{4}-\d{2}$|^present$/i, 'YYYY-MM or present'),
    bullets: zod_1.z.array(exports.BulletSchema),
    confidence: zod_1.z.number().min(0).max(1).optional(),
    origin: ItemOrigin.default('extracted'),
});
exports.SkillSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    proficiency_stated: zod_1.z.enum(['advanced', 'intermediate', 'beginner', 'none']),
    confidence: zod_1.z.number().min(0).max(1).optional(),
    origin: ItemOrigin.default('extracted'),
});
exports.ProjectSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    bullets: zod_1.z.array(exports.BulletSchema),
    confidence: zod_1.z.number().min(0).max(1).optional(),
    origin: ItemOrigin.default('extracted'),
});
exports.EducationSchema = zod_1.z.object({
    id: zod_1.z.string(),
    institution: zod_1.z.string(),
    degree: zod_1.z.string(),
    field: zod_1.z.string().optional(),
    start: zod_1.z.string().optional(),
    end: zod_1.z.string().optional(),
    confidence: zod_1.z.number().min(0).max(1).optional(),
    origin: ItemOrigin.default('extracted'),
});
exports.CertificationSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    issuer: zod_1.z.string().optional(),
    status: zod_1.z.enum(['completed', 'in_progress', 'expired']),
    date: zod_1.z.string().optional(),
    confidence: zod_1.z.number().min(0).max(1).optional(),
    origin: ItemOrigin.default('extracted'),
});
exports.ContactSchema = zod_1.z.object({
    name: zod_1.z.string(),
    email: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    links: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.CandidateInventorySchema = zod_1.z.object({
    contact: exports.ContactSchema,
    summary_raw: zod_1.z.string().optional(),
    experiences: zod_1.z.array(exports.ExperienceSchema),
    skills: zod_1.z.array(exports.SkillSchema),
    projects: zod_1.z.array(exports.ProjectSchema),
    education: zod_1.z.array(exports.EducationSchema),
    certifications: zod_1.z.array(exports.CertificationSchema),
    confirmed: zod_1.z.boolean().default(false),
});
//# sourceMappingURL=inventory.schema.js.map