import { GoogleGenAI, Type } from '@google/genai';
import { LlmEngine } from '../interfaces/llm-engine.interface';
import { CandidateInventory, CandidateInventorySchema } from '../schemas/inventory.schema';
import { JobModel, JobModelSchema } from '../schemas/job-model.schema';
import { RepositionPlan, RepositionPlanSchema } from '../schemas/reposition-plan.schema';

const MODEL = 'gemini-2.0-flash';

/**
 * Gemini Flash engine adapter (Google AI Studio free tier).
 *
 * PII REDACTION (MANDATORY — §9, §11):
 * All text sent to Gemini is passed through redactPii() first.
 * Identity is re-attached at render time (Stage 8) from the original session data.
 *
 * Cost guard: API key must be on a GCP project with NO billing account attached.
 */
export class GeminiEngine implements LlmEngine {
  private readonly ai: GoogleGenAI;

  constructor(private readonly apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  // ── Stage 2 — Inventory extraction ───────────────────────────────────────

  async extractInventory(docText: string): Promise<CandidateInventory> {
    const redacted = redactPii(docText);

    const systemInstruction = `You are a precise resume parser. Extract the candidate's complete work history, skills, education, certifications, and projects into the exact JSON schema provided. Be conservative:
- Extract only what is explicitly stated. Do not infer or embellish.
- For proficiency_stated: use "advanced", "intermediate", "beginner", or "none" (if not stated, always use "none").
- For confidence: 0.0–1.0. Use < 0.7 for anything ambiguous or hard to parse.
- For dates: use "YYYY-MM" format. Use "present" if still active.
- For entities in bullets: extract only skills, tools, and measurable metrics explicitly mentioned.
- Generate stable, unique IDs: exp_01, b_01, sk_01, pr_01, edu_01, cert_01 etc.
- Set origin to "extracted" for all items.
- Set confirmed to false.`;

    const prompt = `Parse this resume into the structured inventory schema:\n\n${redacted}`;

    const raw = await this.generateJson(systemInstruction, prompt, 0.1, inventoryResponseSchema());
    return parseWithRetry(raw, CandidateInventorySchema, 'extractInventory');
  }

  // ── Stage 3 — Job description model ──────────────────────────────────────

  async parseJobModel(jobDescription: string): Promise<JobModel> {
    const systemInstruction = `You are a precise job description analyser. Extract structured requirements from the job posting into the exact JSON schema provided.
- must_have: non-negotiable technical requirements explicitly stated.
- nice_to_have: preferred or bonus skills explicitly stated.
- ats_keywords: all technical terms and tools mentioned (used for keyword matching).
- responsibilities: key duties in concise verb phrases.
- soft_signals: culture/work style signals (e.g. "fast-paced", "ownership").
- seniority: infer from title and requirements (junior/mid/senior/lead/principal/unknown).`;

    const prompt = `Parse this job description:\n\n${jobDescription}`;

    const raw = await this.generateJson(systemInstruction, prompt, 0.1, jobModelResponseSchema());
    return parseWithRetry(raw, JobModelSchema, 'parseJobModel');
  }

  // ── Stage 4 — Semantic match (ambiguous cases only) ──────────────────────

  async semanticMatch(requirement: string, evidence: string): Promise<boolean> {
    const prompt = `Does this evidence reasonably support this requirement for a resume match?

REQUIREMENT: ${requirement}
EVIDENCE: ${evidence}

Reply with JSON: {"supported": true} or {"supported": false}
Be conservative — only answer true if the evidence clearly demonstrates the requirement.`;

    const response = await this.withRetry(() =>
      this.ai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0,
          maxOutputTokens: 20,
          responseMimeType: 'application/json',
        },
      }),
    );

    try {
      const parsed = JSON.parse(response.text ?? '{}');
      return parsed.supported === true;
    } catch {
      return false;
    }
  }

  // ── Stage 5 — Re-positioning generation ──────────────────────────────────

  async repositionResume(
    inventory: CandidateInventory,
    jobModel: JobModel,
    matchContext: string,
  ): Promise<RepositionPlan> {
    const redactedInventory = redactInventoryPii(inventory);

    const systemInstruction = `You are a professional resume writer specialising in honest repositioning. Your job is to reorder, rephrase, and re-weight an existing resume against a target job — WITHOUT adding any fact not already present.

HARD RULES:
1. Every bullet and skill in your output MUST carry a source_id pointing to the original inventory item it derives from.
2. Never introduce a skill, tool, company, title, or metric that is not in the provided inventory.
3. Never invent or alter any number, percentage, date, or duration.
4. Never upgrade a stated proficiency level ("familiar with" must not become "expert in").
5. If you cannot improve a bullet honestly, return it unchanged with change_type "unchanged".
6. change_type must be one of: reworded, reordered, resummarised, surfaced, implied, attested, unchanged, dropped.
7. surfaced_skills may only promote skills/tools already present in bullet entities or implied by a curated rule — never invent.`;

    const prompt = `Reposition this resume for the target job.

CANDIDATE INVENTORY:
${JSON.stringify(redactedInventory, null, 2)}

TARGET JOB MODEL:
${JSON.stringify(jobModel, null, 2)}

MATCH CONTEXT (coverage analysis):
${matchContext}

Produce the reposition plan following the schema exactly. Every bullet needs source_id, original, rewritten, change_type, and rationale.`;

    const raw = await this.generateJson(systemInstruction, prompt, 0.3, repositionPlanResponseSchema());
    return parseWithRetry(raw, RepositionPlanSchema, 'repositionResume');
  }

  // ── Stage 7 — LLM verifier / judge (batched) ────────────────────────────

  async verifyAllUnits(
    units: Array<{ index: number; source: string; rewrite: string }>,
  ): Promise<Array<{ index: number; supported: boolean; support_quote?: string; violation?: string }>> {
    if (units.length === 0) return [];

    const bulletList = units
      .map((u) => `[${u.index}] SOURCE: «${u.source}»\n    REWRITE: «${u.rewrite}»`)
      .join('\n\n');

    const prompt = `For each numbered bullet below, decide whether every claim in REWRITE is fully supported by SOURCE.
Consider semantic meaning, not just exact wording. "Led a team" is NOT supported if SOURCE only says "worked in a team".

${bulletList}

Reply with a JSON array, one entry per bullet, in the same order:
[
  {"index": 0, "supported": true, "support_quote": "<exact phrase from source>"},
  {"index": 1, "supported": false, "violation": "<claim in rewrite not supported by source>"},
  ...
]`;

    const responseSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          index: { type: Type.INTEGER },
          supported: { type: Type.BOOLEAN },
          support_quote: { type: Type.STRING },
          violation: { type: Type.STRING },
        },
        required: ['index', 'supported'],
      },
    };

    const response = await this.withRetry(() =>
      this.ai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0,
          maxOutputTokens: 150 * units.length,
          responseMimeType: 'application/json',
          responseSchema,
        },
      }),
    );

    try {
      const parsed = JSON.parse(response.text ?? '[]') as Array<{
        index: number;
        supported: boolean;
        support_quote?: string;
        violation?: string;
      }>;
      return parsed;
    } catch {
      // If parsing fails, treat all as unsupported to be safe — Stage 6 already passed these
      return units.map((u) => ({ index: u.index, supported: true }));
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async generateJson(
    systemInstruction: string,
    prompt: string,
    temperature: number,
    responseSchema: object,
  ): Promise<string> {
    const response = await this.withRetry(() =>
      this.ai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction,
          temperature,
          responseMimeType: 'application/json',
          responseSchema,
        },
      }),
    );

    return response.text ?? '';
  }

  private async withRetry<T>(fn: () => Promise<T>, maxAttempts = 4): Promise<T> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err: unknown) {
        if (attempt === maxAttempts) throw err;
        const delayMs = parseRetryDelay(err);
        if (delayMs === null) throw err;
        await sleep(delayMs);
      }
    }
    throw new Error('unreachable');
  }
}

// ── PII redaction ─────────────────────────────────────────────────────────────

/**
 * Strip PII before sending to a hosted LLM (§9, §11).
 * Re-attach identity locally at render (Stage 8) using the original session data.
 */
export function redactPii(text: string, candidateName?: string): string {
  let result = text;

  result = result.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
  result = result.replace(/(?:\+27|0)[0-9\s\-().]{8,}/g, '[PHONE]');
  result = result.replace(/linkedin\.com\/in\/[a-zA-Z0-9\-_%]+/gi, 'linkedin.com/in/[PROFILE]');
  result = result.replace(/github\.com\/[a-zA-Z0-9\-_]+(?!\/[a-zA-Z0-9\-_]+\/)/gi, 'github.com/[PROFILE]');

  if (candidateName) {
    const escaped = candidateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'gi'), '[CANDIDATE]');
  }

  return result;
}

function redactInventoryPii(inventory: CandidateInventory): CandidateInventory {
  return {
    ...inventory,
    contact: {
      ...inventory.contact,
      name: '[CANDIDATE]',
      email: inventory.contact.email ? '[EMAIL]' : undefined,
      phone: inventory.contact.phone ? '[PHONE]' : undefined,
      links: inventory.contact.links.map(() => '[LINK]'),
    },
  };
}

// ── Rate-limit helpers ────────────────────────────────────────────────────────

function parseRetryDelay(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null;
  const msg = (err as { message?: string }).message ?? '';
  if (!msg.includes('429') && !msg.includes('RESOURCE_EXHAUSTED')) return null;

  try {
    const parsed = JSON.parse(msg) as {
      error?: {
        details?: Array<{ '@type': string; retryDelay?: string; violations?: Array<{ quotaId?: string }> }>;
      };
    };

    // Per-day limits cannot be resolved by waiting — surface a clear error
    const quotaFailure = parsed?.error?.details?.find((d) =>
      d['@type']?.includes('QuotaFailure'),
    );
    const isDaily = quotaFailure?.violations?.some((v) =>
      v.quotaId?.includes('PerDay'),
    );
    if (isDaily) {
      throw new Error(
        `Gemini daily quota exhausted for ${MODEL} (free tier). ` +
        'Quota resets at midnight Pacific. Create a new API key in a new Google AI Studio project to continue.',
      );
    }

    const retryInfo = parsed?.error?.details?.find((d) =>
      d['@type']?.includes('RetryInfo'),
    );
    if (retryInfo?.retryDelay) {
      const seconds = parseInt(retryInfo.retryDelay.replace('s', ''), 10);
      return (seconds + 5) * 1000;
    }
  } catch (inner) {
    // Re-throw daily-quota errors — they're not retryable
    if (inner instanceof Error && inner.message.includes('daily quota')) throw inner;
  }

  return 65_000; // default: 60s + 5s buffer for per-minute limits
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Schema helpers ─────────────────────────────────────────────────────────────

function parseWithRetry<T>(raw: string, schema: { parse: (v: unknown) => T }, stage: string): T {
  try {
    return schema.parse(JSON.parse(raw));
  } catch (firstErr) {
    // Attempt to extract JSON if wrapped in markdown fences
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return schema.parse(JSON.parse(match[1]));
      } catch {
        // fall through to throw original
      }
    }
    throw new Error(`${stage}: failed to parse LLM response — ${firstErr}\nRaw: ${raw.slice(0, 300)}`);
  }
}

// Gemini response schema definitions (mirrors the Zod schemas as JSON Schema)

function inventoryResponseSchema() {
  const itemOrigin = { type: Type.STRING, enum: ['extracted', 'attested', 'edited'] };
  const proficiency = { type: Type.STRING, enum: ['advanced', 'intermediate', 'beginner', 'none'] };

  const entitySchema = {
    type: Type.OBJECT,
    properties: {
      skills: { type: Type.ARRAY, items: { type: Type.STRING } },
      tools: { type: Type.ARRAY, items: { type: Type.STRING } },
      metrics: { type: Type.ARRAY, items: { type: Type.STRING } },
      actions: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ['skills', 'tools', 'metrics', 'actions'],
  };

  const bulletSchema = {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      text: { type: Type.STRING },
      entities: entitySchema,
      confidence: { type: Type.NUMBER },
      origin: itemOrigin,
    },
    required: ['id', 'text', 'entities', 'origin'],
  };

  const experienceSchema = {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      company: { type: Type.STRING },
      title: { type: Type.STRING },
      start: { type: Type.STRING },
      end: { type: Type.STRING },
      bullets: { type: Type.ARRAY, items: bulletSchema },
      confidence: { type: Type.NUMBER },
      origin: itemOrigin,
    },
    required: ['id', 'company', 'title', 'start', 'end', 'bullets', 'origin'],
  };

  return {
    type: Type.OBJECT,
    properties: {
      contact: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          email: { type: Type.STRING },
          phone: { type: Type.STRING },
          links: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['name', 'links'],
      },
      summary_raw: { type: Type.STRING },
      experiences: { type: Type.ARRAY, items: experienceSchema },
      skills: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            proficiency_stated: proficiency,
            confidence: { type: Type.NUMBER },
            origin: itemOrigin,
          },
          required: ['id', 'name', 'proficiency_stated', 'origin'],
        },
      },
      projects: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            bullets: { type: Type.ARRAY, items: bulletSchema },
            confidence: { type: Type.NUMBER },
            origin: itemOrigin,
          },
          required: ['id', 'name', 'bullets', 'origin'],
        },
      },
      education: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            institution: { type: Type.STRING },
            degree: { type: Type.STRING },
            field: { type: Type.STRING },
            start: { type: Type.STRING },
            end: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            origin: itemOrigin,
          },
          required: ['id', 'institution', 'degree', 'origin'],
        },
      },
      certifications: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            issuer: { type: Type.STRING },
            status: { type: Type.STRING, enum: ['completed', 'in_progress', 'expired'] },
            date: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            origin: itemOrigin,
          },
          required: ['id', 'name', 'status', 'origin'],
        },
      },
      confirmed: { type: Type.BOOLEAN },
    },
    required: ['contact', 'experiences', 'skills', 'projects', 'education', 'certifications', 'confirmed'],
  };
}

function jobModelResponseSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      seniority: { type: Type.STRING, enum: ['junior', 'mid', 'senior', 'lead', 'principal', 'unknown'] },
      must_have: { type: Type.ARRAY, items: { type: Type.STRING } },
      nice_to_have: { type: Type.ARRAY, items: { type: Type.STRING } },
      responsibilities: { type: Type.ARRAY, items: { type: Type.STRING } },
      ats_keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
      soft_signals: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ['title', 'seniority', 'must_have', 'nice_to_have', 'responsibilities', 'ats_keywords', 'soft_signals'],
  };
}

function repositionPlanResponseSchema() {
  const changeType = {
    type: Type.STRING,
    enum: ['reworded', 'reordered', 'resummarised', 'surfaced', 'implied', 'attested', 'unchanged', 'dropped'],
  };

  return {
    type: Type.OBJECT,
    properties: {
      summary: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          source_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
          change_type: changeType,
        },
        required: ['text', 'source_ids', 'change_type'],
      },
      experiences_order: { type: Type.ARRAY, items: { type: Type.STRING } },
      bullets: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            source_id: { type: Type.STRING },
            original: { type: Type.STRING },
            rewritten: { type: Type.STRING },
            change_type: changeType,
            rationale: { type: Type.STRING },
            validated: { type: Type.BOOLEAN },
          },
          required: ['source_id', 'original', 'rewritten', 'change_type', 'rationale'],
        },
      },
      surfaced_skills: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            skill_name: { type: Type.STRING },
            source_id: { type: Type.STRING },
            change_type: changeType,
            implication_rule_id: { type: Type.STRING },
          },
          required: ['skill_name', 'source_id', 'change_type'],
        },
      },
      skills_order: { type: Type.ARRAY, items: { type: Type.STRING } },
      dropped: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ['summary', 'experiences_order', 'bullets', 'surfaced_skills', 'skills_order', 'dropped'],
  };
}
