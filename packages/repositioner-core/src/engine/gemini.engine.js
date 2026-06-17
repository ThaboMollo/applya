"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiEngine = void 0;
exports.redactPii = redactPii;
const genai_1 = require("@google/genai");
const inventory_schema_1 = require("../schemas/inventory.schema");
const job_model_schema_1 = require("../schemas/job-model.schema");
const reposition_plan_schema_1 = require("../schemas/reposition-plan.schema");
const MODEL = 'gemini-2.5-flash';
class GeminiEngine {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.ai = new genai_1.GoogleGenAI({ apiKey });
    }
    async extractInventory(docText) {
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
        return parseWithRetry(raw, inventory_schema_1.CandidateInventorySchema, 'extractInventory');
    }
    async parseJobModel(jobDescription) {
        const systemInstruction = `You are a precise job description analyser. Extract structured requirements from the job posting into the exact JSON schema provided.
- must_have: non-negotiable technical requirements explicitly stated.
- nice_to_have: preferred or bonus skills explicitly stated.
- ats_keywords: all technical terms and tools mentioned (used for keyword matching).
- responsibilities: key duties in concise verb phrases.
- soft_signals: culture/work style signals (e.g. "fast-paced", "ownership").
- seniority: infer from title and requirements (junior/mid/senior/lead/principal/unknown).`;
        const prompt = `Parse this job description:\n\n${jobDescription}`;
        const raw = await this.generateJson(systemInstruction, prompt, 0.1, jobModelResponseSchema());
        return parseWithRetry(raw, job_model_schema_1.JobModelSchema, 'parseJobModel');
    }
    async semanticMatch(requirement, evidence) {
        const prompt = `Does this evidence reasonably support this requirement for a resume match?

REQUIREMENT: ${requirement}
EVIDENCE: ${evidence}

Reply with JSON: {"supported": true} or {"supported": false}
Be conservative — only answer true if the evidence clearly demonstrates the requirement.`;
        const response = await this.ai.models.generateContent({
            model: MODEL,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                temperature: 0,
                maxOutputTokens: 20,
                responseMimeType: 'application/json',
            },
        });
        try {
            const parsed = JSON.parse(response.text ?? '{}');
            return parsed.supported === true;
        }
        catch {
            return false;
        }
    }
    async repositionResume(inventory, jobModel, matchContext) {
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
        return parseWithRetry(raw, reposition_plan_schema_1.RepositionPlanSchema, 'repositionResume');
    }
    async verifyUnit(source, rewrite) {
        const prompt = `SOURCE: «${source}»
REWRITE: «${rewrite}»

Is every claim in REWRITE fully supported by SOURCE? Consider semantic meaning, not just exact wording. "Led a team" is NOT supported if SOURCE only says "worked in a team".

Reply with JSON only:
- If supported: {"supported": true, "support_quote": "<exact phrase from source that supports it>"}
- If not supported: {"supported": false, "violation": "<what claim in the rewrite is not supported>"}`;
        const response = await this.ai.models.generateContent({
            model: MODEL,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                temperature: 0,
                maxOutputTokens: 150,
                responseMimeType: 'application/json',
            },
        });
        try {
            return JSON.parse(response.text ?? '{"supported": false, "violation": "parse error"}');
        }
        catch {
            return { supported: false, violation: 'Failed to parse verifier response' };
        }
    }
    async generateJson(systemInstruction, prompt, temperature, responseSchema) {
        const response = await this.ai.models.generateContent({
            model: MODEL,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                systemInstruction,
                temperature,
                responseMimeType: 'application/json',
                responseSchema,
            },
        });
        return response.text ?? '';
    }
}
exports.GeminiEngine = GeminiEngine;
function redactPii(text, candidateName) {
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
function redactInventoryPii(inventory) {
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
function parseWithRetry(raw, schema, stage) {
    try {
        return schema.parse(JSON.parse(raw));
    }
    catch (firstErr) {
        const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) {
            try {
                return schema.parse(JSON.parse(match[1]));
            }
            catch {
            }
        }
        throw new Error(`${stage}: failed to parse LLM response — ${firstErr}\nRaw: ${raw.slice(0, 300)}`);
    }
}
function inventoryResponseSchema() {
    const itemOrigin = { type: genai_1.Type.STRING, enum: ['extracted', 'attested', 'edited'] };
    const proficiency = { type: genai_1.Type.STRING, enum: ['advanced', 'intermediate', 'beginner', 'none'] };
    const entitySchema = {
        type: genai_1.Type.OBJECT,
        properties: {
            skills: { type: genai_1.Type.ARRAY, items: { type: genai_1.Type.STRING } },
            tools: { type: genai_1.Type.ARRAY, items: { type: genai_1.Type.STRING } },
            metrics: { type: genai_1.Type.ARRAY, items: { type: genai_1.Type.STRING } },
            actions: { type: genai_1.Type.ARRAY, items: { type: genai_1.Type.STRING } },
        },
        required: ['skills', 'tools', 'metrics', 'actions'],
    };
    const bulletSchema = {
        type: genai_1.Type.OBJECT,
        properties: {
            id: { type: genai_1.Type.STRING },
            text: { type: genai_1.Type.STRING },
            entities: entitySchema,
            confidence: { type: genai_1.Type.NUMBER },
            origin: itemOrigin,
        },
        required: ['id', 'text', 'entities', 'origin'],
    };
    const experienceSchema = {
        type: genai_1.Type.OBJECT,
        properties: {
            id: { type: genai_1.Type.STRING },
            company: { type: genai_1.Type.STRING },
            title: { type: genai_1.Type.STRING },
            start: { type: genai_1.Type.STRING },
            end: { type: genai_1.Type.STRING },
            bullets: { type: genai_1.Type.ARRAY, items: bulletSchema },
            confidence: { type: genai_1.Type.NUMBER },
            origin: itemOrigin,
        },
        required: ['id', 'company', 'title', 'start', 'end', 'bullets', 'origin'],
    };
    return {
        type: genai_1.Type.OBJECT,
        properties: {
            contact: {
                type: genai_1.Type.OBJECT,
                properties: {
                    name: { type: genai_1.Type.STRING },
                    email: { type: genai_1.Type.STRING },
                    phone: { type: genai_1.Type.STRING },
                    links: { type: genai_1.Type.ARRAY, items: { type: genai_1.Type.STRING } },
                },
                required: ['name', 'links'],
            },
            summary_raw: { type: genai_1.Type.STRING },
            experiences: { type: genai_1.Type.ARRAY, items: experienceSchema },
            skills: {
                type: genai_1.Type.ARRAY,
                items: {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        id: { type: genai_1.Type.STRING },
                        name: { type: genai_1.Type.STRING },
                        proficiency_stated: proficiency,
                        confidence: { type: genai_1.Type.NUMBER },
                        origin: itemOrigin,
                    },
                    required: ['id', 'name', 'proficiency_stated', 'origin'],
                },
            },
            projects: {
                type: genai_1.Type.ARRAY,
                items: {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        id: { type: genai_1.Type.STRING },
                        name: { type: genai_1.Type.STRING },
                        description: { type: genai_1.Type.STRING },
                        bullets: { type: genai_1.Type.ARRAY, items: bulletSchema },
                        confidence: { type: genai_1.Type.NUMBER },
                        origin: itemOrigin,
                    },
                    required: ['id', 'name', 'bullets', 'origin'],
                },
            },
            education: {
                type: genai_1.Type.ARRAY,
                items: {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        id: { type: genai_1.Type.STRING },
                        institution: { type: genai_1.Type.STRING },
                        degree: { type: genai_1.Type.STRING },
                        field: { type: genai_1.Type.STRING },
                        start: { type: genai_1.Type.STRING },
                        end: { type: genai_1.Type.STRING },
                        confidence: { type: genai_1.Type.NUMBER },
                        origin: itemOrigin,
                    },
                    required: ['id', 'institution', 'degree', 'origin'],
                },
            },
            certifications: {
                type: genai_1.Type.ARRAY,
                items: {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        id: { type: genai_1.Type.STRING },
                        name: { type: genai_1.Type.STRING },
                        issuer: { type: genai_1.Type.STRING },
                        status: { type: genai_1.Type.STRING, enum: ['completed', 'in_progress', 'expired'] },
                        date: { type: genai_1.Type.STRING },
                        confidence: { type: genai_1.Type.NUMBER },
                        origin: itemOrigin,
                    },
                    required: ['id', 'name', 'status', 'origin'],
                },
            },
            confirmed: { type: genai_1.Type.BOOLEAN },
        },
        required: ['contact', 'experiences', 'skills', 'projects', 'education', 'certifications', 'confirmed'],
    };
}
function jobModelResponseSchema() {
    return {
        type: genai_1.Type.OBJECT,
        properties: {
            title: { type: genai_1.Type.STRING },
            seniority: { type: genai_1.Type.STRING, enum: ['junior', 'mid', 'senior', 'lead', 'principal', 'unknown'] },
            must_have: { type: genai_1.Type.ARRAY, items: { type: genai_1.Type.STRING } },
            nice_to_have: { type: genai_1.Type.ARRAY, items: { type: genai_1.Type.STRING } },
            responsibilities: { type: genai_1.Type.ARRAY, items: { type: genai_1.Type.STRING } },
            ats_keywords: { type: genai_1.Type.ARRAY, items: { type: genai_1.Type.STRING } },
            soft_signals: { type: genai_1.Type.ARRAY, items: { type: genai_1.Type.STRING } },
        },
        required: ['title', 'seniority', 'must_have', 'nice_to_have', 'responsibilities', 'ats_keywords', 'soft_signals'],
    };
}
function repositionPlanResponseSchema() {
    const changeType = {
        type: genai_1.Type.STRING,
        enum: ['reworded', 'reordered', 'resummarised', 'surfaced', 'implied', 'attested', 'unchanged', 'dropped'],
    };
    return {
        type: genai_1.Type.OBJECT,
        properties: {
            summary: {
                type: genai_1.Type.OBJECT,
                properties: {
                    text: { type: genai_1.Type.STRING },
                    source_ids: { type: genai_1.Type.ARRAY, items: { type: genai_1.Type.STRING } },
                    change_type: changeType,
                },
                required: ['text', 'source_ids', 'change_type'],
            },
            experiences_order: { type: genai_1.Type.ARRAY, items: { type: genai_1.Type.STRING } },
            bullets: {
                type: genai_1.Type.ARRAY,
                items: {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        source_id: { type: genai_1.Type.STRING },
                        original: { type: genai_1.Type.STRING },
                        rewritten: { type: genai_1.Type.STRING },
                        change_type: changeType,
                        rationale: { type: genai_1.Type.STRING },
                        validated: { type: genai_1.Type.BOOLEAN },
                    },
                    required: ['source_id', 'original', 'rewritten', 'change_type', 'rationale'],
                },
            },
            surfaced_skills: {
                type: genai_1.Type.ARRAY,
                items: {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        skill_name: { type: genai_1.Type.STRING },
                        source_id: { type: genai_1.Type.STRING },
                        change_type: changeType,
                        implication_rule_id: { type: genai_1.Type.STRING },
                    },
                    required: ['skill_name', 'source_id', 'change_type'],
                },
            },
            skills_order: { type: genai_1.Type.ARRAY, items: { type: genai_1.Type.STRING } },
            dropped: { type: genai_1.Type.ARRAY, items: { type: genai_1.Type.STRING } },
        },
        required: ['summary', 'experiences_order', 'bullets', 'surfaced_skills', 'skills_order', 'dropped'],
    };
}
//# sourceMappingURL=gemini.engine.js.map