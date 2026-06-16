import { CandidateInventory } from '../schemas/inventory.schema';
import { JobModel } from '../schemas/job-model.schema';
import { RepositionPlan } from '../schemas/reposition-plan.schema';

/**
 * All LLM use in repositioner-core goes through this interface.
 * Current implementation: GeminiEngine (free tier, Flash model).
 * Drop-in alternatives: OllamaEngine (local, no PII risk), AnthropicEngine (paid).
 *
 * PII RULE: Any engine that sends data off-device (Gemini, Anthropic) MUST
 * redact name/email/phone/employer before the call and re-attach locally.
 * OllamaEngine may skip redaction since nothing leaves the machine.
 */
export interface LlmEngine {
  /**
   * Stage 2 — parse DoclingDocument text into CandidateInventory.
   * Input text must have PII redacted by the caller before passing here
   * if the engine is hosted (Gemini/Anthropic).
   */
  extractInventory(docText: string): Promise<CandidateInventory>;

  /**
   * Stage 3 — parse job description text into JobModel.
   */
  parseJobModel(jobDescription: string): Promise<JobModel>;

  /**
   * Stage 4 — semantic match for ambiguous requirement ↔ evidence pairs
   * that deterministic matching (exact/synonym/implication) couldn't classify.
   * Returns true if the evidence reasonably supports the requirement.
   */
  semanticMatch(requirement: string, evidence: string): Promise<boolean>;

  /**
   * Stage 5 — re-position the resume.
   * Must emit source_id + change_type for every unit.
   */
  repositionResume(
    inventory: CandidateInventory,
    jobModel: JobModel,
    matchContext: string,
  ): Promise<RepositionPlan>;

  /**
   * Stage 7 — narrow verifier call.
   * Returns whether every claim in `rewrite` is fully supported by `source`.
   */
  verifyUnit(
    source: string,
    rewrite: string,
  ): Promise<{ supported: boolean; support_quote?: string; violation?: string }>;
}
