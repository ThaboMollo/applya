import { z } from 'zod';

export const ChangeType = z.enum([
  'reworded',
  'reordered',
  'resummarised',
  'surfaced',   // latent skill promoted to Skills section
  'implied',    // added via curated implication rule
  'attested',   // user-vouched
  'unchanged',
  'dropped',
]);

export const RewrittenBulletSchema = z.object({
  source_id: z.string(),
  original: z.string(),
  rewritten: z.string(),
  change_type: ChangeType,
  rationale: z.string(),
  /** true = passed Stage 6 + 7, false = flagged/reverted */
  validated: z.boolean().default(false),
});

export const SurfacedSkillSchema = z.object({
  skill_name: z.string(),
  source_id: z.string(),
  change_type: ChangeType,
  implication_rule_id: z.string().optional(),
});

export const RepositionPlanSchema = z.object({
  summary: z.object({
    text: z.string(),
    source_ids: z.array(z.string()),
    change_type: ChangeType,
  }),
  experiences_order: z.array(z.string()),
  bullets: z.array(RewrittenBulletSchema),
  surfaced_skills: z.array(SurfacedSkillSchema),
  skills_order: z.array(z.string()),
  dropped: z.array(z.string()),
});

export const ValidationResultSchema = z.object({
  unit_id: z.string(),
  result: z.enum(['pass', 'fail']),
  reason: z.string().optional(),
  rule_violated: z.enum([
    'skill_not_in_inventory',
    'metric_invented',
    'proficiency_inflated',
    'semantic_inflation',
    'title_not_in_inventory',
  ]).optional(),
});

export const IntegrityReportSchema = z.object({
  results: z.array(ValidationResultSchema),
  ai_change_summary: z.object({
    repositioned: z.number(),
    reworded: z.number(),
    surfaced: z.number(),
    implied: z.number(),
    fabricated: z.number(),
  }),
  user_change_summary: z.object({
    attested: z.number(),
    edited: z.number(),
  }),
});

export type ChangeType = z.infer<typeof ChangeType>;
export type RewrittenBullet = z.infer<typeof RewrittenBulletSchema>;
export type SurfacedSkill = z.infer<typeof SurfacedSkillSchema>;
export type RepositionPlan = z.infer<typeof RepositionPlanSchema>;
export type ValidationResult = z.infer<typeof ValidationResultSchema>;
export type IntegrityReport = z.infer<typeof IntegrityReportSchema>;
