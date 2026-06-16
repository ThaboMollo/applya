import { z } from 'zod';

const ItemOrigin = z.enum(['extracted', 'attested', 'edited']);

export const EntitySchema = z.object({
  skills: z.array(z.string()),
  tools: z.array(z.string()),
  metrics: z.array(z.string()),
  actions: z.array(z.string()),
});

export const BulletSchema = z.object({
  id: z.string(),
  text: z.string(),
  entities: EntitySchema,
  confidence: z.number().min(0).max(1).optional(),
  origin: ItemOrigin.default('extracted'),
});

export const ExperienceSchema = z.object({
  id: z.string(),
  company: z.string(),
  title: z.string(),
  start: z.string().regex(/^\d{4}-\d{2}$/, 'YYYY-MM'),
  end: z.string().regex(/^\d{4}-\d{2}$|^present$/i, 'YYYY-MM or present'),
  bullets: z.array(BulletSchema),
  confidence: z.number().min(0).max(1).optional(),
  origin: ItemOrigin.default('extracted'),
});

export const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  /**
   * "advanced" | "intermediate" | "beginner" | "none"
   * "none" means no proficiency level was stated — the validator blocks upgrades from none.
   */
  proficiency_stated: z.enum(['advanced', 'intermediate', 'beginner', 'none']),
  confidence: z.number().min(0).max(1).optional(),
  origin: ItemOrigin.default('extracted'),
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  bullets: z.array(BulletSchema),
  confidence: z.number().min(0).max(1).optional(),
  origin: ItemOrigin.default('extracted'),
});

export const EducationSchema = z.object({
  id: z.string(),
  institution: z.string(),
  degree: z.string(),
  field: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  origin: ItemOrigin.default('extracted'),
});

export const CertificationSchema = z.object({
  id: z.string(),
  name: z.string(),
  issuer: z.string().optional(),
  status: z.enum(['completed', 'in_progress', 'expired']),
  date: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  origin: ItemOrigin.default('extracted'),
});

export const ContactSchema = z.object({
  name: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  links: z.array(z.string()).default([]),
});

export const CandidateInventorySchema = z.object({
  contact: ContactSchema,
  summary_raw: z.string().optional(),
  experiences: z.array(ExperienceSchema),
  skills: z.array(SkillSchema),
  projects: z.array(ProjectSchema),
  education: z.array(EducationSchema),
  certifications: z.array(CertificationSchema),
  confirmed: z.boolean().default(false),
});

export type ItemOrigin = z.infer<typeof ItemOrigin>;
export type Bullet = z.infer<typeof BulletSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Certification = z.infer<typeof CertificationSchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type CandidateInventory = z.infer<typeof CandidateInventorySchema>;
