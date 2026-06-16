import { z } from 'zod';

export const JobModelSchema = z.object({
  title: z.string(),
  seniority: z.enum(['junior', 'mid', 'senior', 'lead', 'principal', 'unknown']),
  must_have: z.array(z.string()),
  nice_to_have: z.array(z.string()),
  responsibilities: z.array(z.string()),
  ats_keywords: z.array(z.string()),
  soft_signals: z.array(z.string()),
});

export type JobModel = z.infer<typeof JobModelSchema>;

/**
 * Per-requirement coverage classification from Stage 4.
 * - covered: in the inventory's Skills section already
 * - latent: in a bullet/project/implication but not surfaced as a skill
 * - gap: no evidence anywhere → Honest Gaps panel only, never injected
 */
export const RequirementCoverageSchema = z.object({
  requirement: z.string(),
  bucket: z.enum(['covered', 'latent', 'gap']),
  source_ids: z.array(z.string()),
  match_rule: z.enum(['exact', 'synonym', 'implication', 'semantic', 'none']),
  implication_antecedent: z.string().optional(),
});

export const MatchReportSchema = z.object({
  must_have: z.array(RequirementCoverageSchema),
  nice_to_have: z.array(RequirementCoverageSchema),
  /** weighted score: (covered + latent) / total requirements × 100 */
  match_score: z.number().min(0).max(100),
  gaps: z.array(z.string()),
});

export type RequirementCoverage = z.infer<typeof RequirementCoverageSchema>;
export type MatchReport = z.infer<typeof MatchReportSchema>;
