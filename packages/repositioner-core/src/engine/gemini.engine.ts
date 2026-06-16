import { LlmEngine } from '../interfaces/llm-engine.interface';
import { CandidateInventory, CandidateInventorySchema } from '../schemas/inventory.schema';
import { JobModel, JobModelSchema } from '../schemas/job-model.schema';
import { RepositionPlan, RepositionPlanSchema } from '../schemas/reposition-plan.schema';

/**
 * Gemini Flash engine adapter (Google AI Studio free tier).
 *
 * PII REDACTION (MANDATORY — see §9, §11):
 * The Gemini free tier may train on prompts. Before any text is sent to Gemini,
 * the caller MUST call redactPii() to strip name/email/phone/employer.
 * Re-attach identity locally at render time (Stage 8).
 * This is enforced at the engine level, not assumed of callers.
 *
 * Cost guard: create the API key on a Google Cloud project with NO billing
 * account attached, so quota overruns fail rather than charge.
 *
 * Model: gemini-2.5-flash (confirm current model ID + free limits in AI Studio
 * at build time — Google changes these and they vary by region).
 *
 * TODO: implement all methods below using @google/genai SDK.
 */
export class GeminiEngine implements LlmEngine {
  constructor(private readonly apiKey: string) {}

  async extractInventory(docText: string): Promise<CandidateInventory> {
    const redacted = redactPii(docText);
    // TODO:
    // 1. Build system prompt + user message requesting CandidateInventory JSON
    // 2. Set response_schema to match CandidateInventorySchema
    // 3. Use low temperature (0.1) for extraction accuracy
    // 4. Parse + validate with CandidateInventorySchema.parse()
    // 5. Retry once on parse failure
    throw new Error('GeminiEngine.extractInventory not implemented');
  }

  async parseJobModel(jobDescription: string): Promise<JobModel> {
    // TODO: similar pattern to extractInventory, targeting JobModelSchema
    throw new Error('GeminiEngine.parseJobModel not implemented');
  }

  async semanticMatch(requirement: string, evidence: string): Promise<boolean> {
    // TODO: narrow binary call — "Does this evidence reasonably support this requirement?"
    // Temperature: 0 (deterministic)
    throw new Error('GeminiEngine.semanticMatch not implemented');
  }

  async repositionResume(
    inventory: CandidateInventory,
    jobModel: JobModel,
    matchContext: string,
  ): Promise<RepositionPlan> {
    // TODO:
    // 1. Redact PII from inventory before serialising to prompt
    // 2. Set moderate temperature (~0.3) for rewriting
    // 3. Strict constraint in system prompt: every unit MUST carry source_id + change_type
    //    and must NEVER introduce facts absent from the inventory
    // 4. Parse + validate with RepositionPlanSchema.parse()
    throw new Error('GeminiEngine.repositionResume not implemented');
  }

  async verifyUnit(
    source: string,
    rewrite: string,
  ): Promise<{ supported: boolean; support_quote?: string; violation?: string }> {
    // TODO:
    // Prompt: "SOURCE: «source». REWRITE: «rewrite».
    //          Is every claim in REWRITE fully supported by SOURCE?
    //          Reply JSON: { supported, support_quote, violation }"
    // Temperature: 0
    throw new Error('GeminiEngine.verifyUnit not implemented');
  }
}

/**
 * Strip PII before sending to a hosted LLM.
 * Re-attach identity locally at render (Stage 8) using the original session data.
 *
 * Patterns to strip:
 * - Full name (requires knowing the candidate's name from the inventory)
 * - Email addresses
 * - Phone numbers
 * - LinkedIn / GitHub URLs (contain identifiable usernames)
 *
 * Employer names are NOT stripped here — they're part of the experience context
 * the model needs. Instead, replace them with generic placeholders only if
 * GDPR/POPIA legal review requires it for the specific engine in use.
 */
export function redactPii(text: string, candidateName?: string): string {
  let result = text;

  // Email addresses
  result = result.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');

  // Phone numbers (SA and international formats)
  result = result.replace(/(?:\+27|0)[0-9\s\-().]{8,}/g, '[PHONE]');

  // LinkedIn profile URLs
  result = result.replace(/linkedin\.com\/in\/[a-zA-Z0-9\-_%]+/gi, 'linkedin.com/in/[PROFILE]');

  // GitHub profile URLs
  result = result.replace(/github\.com\/[a-zA-Z0-9\-_]+(?!\/[a-zA-Z0-9\-_]+\/)/gi, 'github.com/[PROFILE]');

  // Candidate full name (if provided)
  if (candidateName) {
    const escapedName = candidateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escapedName, 'gi'), '[CANDIDATE]');
  }

  return result;
}
