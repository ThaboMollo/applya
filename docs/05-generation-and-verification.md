# Phase 5 — Re-positioning Generation & LLM Verification

**Spec references:** §5 Stages 5 + 7, §1 (allowed operations), §2 (constrained generation)
**Depends on:** Phase 1 (inventory), Phase 3 (validator), Phase 4 (match report).
**Produces:** A fully validated `RepositionPlan` — every bullet rewritten, reordered, or kept unchanged, with source tracing and integrity verification.

---

## 1. What this phase delivers

The core generation call (Stage 5) and the semantic safety net (Stage 7). Together with the deterministic validator from Phase 3 (Stage 6), these form a three-layer sandwich:

```
Stage 5: Generate → Stage 6: Programmatic validate → Stage 7: Semantic judge
```

A unit only ships to the user if it passes both Stage 6 and Stage 7.

---

## 2. Stage 5 — Re-positioning generation

### 2.1 Reposition plan schema

```typescript
// packages/repositioner-core/src/schemas/reposition-plan.schema.ts

const RepositionedBulletSchema = z.object({
  source_id: z.string(),              // the inventory bullet ID this derives from
  original: z.string(),               // verbatim original text
  rewritten: z.string(),              // the repositioned text (may be identical)
  change_type: z.enum([
    "unchanged",    // bullet kept as-is (no improvement possible or not relevant)
    "reworded",     // rephrased to use JD terminology / surface relevance
    "reordered",    // moved up/down in priority (text unchanged)
    "surfaced",     // a latent skill was promoted from this bullet to skills section
    "dropped",      // demoted/removed as irrelevant to this JD
  ]),
  rationale: z.string(),              // why this change was made (for audit trail)
});

const RepositionPlanSchema = z.object({
  summary: z.object({
    text: z.string(),
    source_ids: z.array(z.string()),   // inventory items the summary draws from
    change_type: z.literal("resummarised"),
  }),
  experiences_order: z.array(z.string()),   // experience IDs in new order
  bullets: z.array(RepositionedBulletSchema),
  skills_order: z.array(z.string()),        // skill IDs in new order
  surfaced_skills: z.array(z.object({       // latent skills promoted to skills section
    name: z.string(),
    source_id: z.string(),                  // the bullet/project that evidences this skill
    via: z.enum(["latent", "implication"]),  // how it was discovered
  })),
  dropped: z.array(z.string()),             // bullet IDs demoted/removed
});
```

### 2.2 Generation call

```typescript
// packages/repositioner-core/src/stages/stage5-reposition.ts

export interface RepositionInput {
  inventory: CandidateInventory;
  jobRequirements: JobRequirements;
  matchReport: MatchReport;
}

export async function generateRepositionPlan(
  input: RepositionInput,
  engine: LlmEngine,
): Promise<RepositionPlan> {
  const plan = await engine.reposition(input);

  // Post-processing:
  // 1. Ensure every bullet has a valid source_id
  // 2. Ensure dropped bullets are accounted for
  // 3. Fill in "unchanged" for any inventory bullets not mentioned
  //    (the LLM may omit unchanged bullets — backfill them)

  return plan;
}
```

### 2.3 System prompt (the constraint layer)

The system prompt is the first line of defence. It must be explicit about what is and isn't allowed:

```
You are a resume re-positioning engine. Your job is to tailor an existing resume 
to a target job description. You must NEVER add information that isn't in the 
source inventory.

ALLOWED operations:
- REORDER: Move experiences, bullets, or skills to surface the most relevant ones first.
- REWORD: Rephrase a bullet to use the job description's terminology while 
  preserving the original meaning and all factual claims.
- RESURFACE: Promote a skill that appears in a bullet/project into the skills section 
  when the JD calls for it.
- RESUMMARISE: Write a targeted professional summary using ONLY facts from the inventory.
- DROP: Demote or remove bullets that are irrelevant to this job.

FORBIDDEN:
- NEVER add a skill, tool, company, title, or responsibility not in the inventory.
- NEVER invent or change any number, metric, percentage, date, or duration.
- NEVER upgrade stated proficiency ("familiar" → "expert").
- NEVER imply experience the candidate did not claim.
- If you cannot honestly improve a bullet for this job, return it UNCHANGED.

OUTPUT RULES:
- Every bullet must include a source_id matching an inventory bullet ID.
- Every bullet must include a change_type.
- Every bullet must include a rationale explaining WHY you made this change.
- Emit valid JSON matching the provided schema. No markdown, no prose.

INPUTS:
- Candidate Inventory: [inventory JSON]
- Job Requirements: [JD model JSON]
- Match Report: [match report JSON — tells you what's covered, latent, and gap]

Use the match report to guide your priorities:
- COVERED skills: keep, reorder higher if needed.
- LATENT skills: surface them — this is the core value of this tool.
- GAP skills: do NOT mention them. They go to the Honest Gaps panel, not the resume.
```

**Temperature:** 0.3–0.5 (moderate creativity for rephrasing, but not so high that it hallucinates).

**Output token limit:** Sized to the expected schema length (e.g., 4000–8000 tokens depending on resume length).

---

## 3. Stage 5 → Stage 6 → Stage 7 pipeline

After generation, the reposition plan runs through the validator and judge in sequence:

```typescript
// packages/repositioner-core/src/stages/phase-b-pipeline.ts

export async function runPhaseB(
  session: Session,
  engine: LlmEngine,
  synonymResolver: SynonymResolver,
  implicationRules: ImplicationRule[],
): Promise<{
  repositionPlan: RepositionPlan;
  integrityReport: IntegrityReport;
}> {
  // Stage 3: Extract JD requirements
  const jobRequirements = await extractJobRequirements(session.jobText, engine);

  // Stage 4: Match & gap analysis
  const matchReport = await matchRequirements(
    jobRequirements, session.inventory, synonymResolver, implicationRules, engine
  );

  // Stage 5: Generate reposition plan
  let plan = await generateRepositionPlan(
    { inventory: session.inventory, jobRequirements, matchReport },
    engine,
  );

  // Stage 6: Programmatic validation
  const validator = new Validator(session.inventory, synonymResolver, implicationRules);
  const validationResults = validator.validatePlan(plan);

  // Handle failures
  const failedUnits = validationResults.filter(r => r.status === "fail");
  for (const failed of failedUnits) {
    // Auto-strip or revert depending on violation type
    plan = handleValidationFailure(plan, failed);
  }

  // Stage 7: LLM judge (only for reworded/surfaced units, not unchanged)
  const unitsToJudge = plan.bullets.filter(b =>
    b.change_type === "reworded" || b.change_type === "surfaced"
  );

  const judgeResults: JudgeResult[] = [];
  for (const unit of unitsToJudge) {
    const verdict = await engine.judge(unit.original, unit.rewritten);
    judgeResults.push({ unitId: unit.source_id, verdict });

    if (!verdict.supported) {
      // Try regenerating once with the violation as feedback
      const retried = await regenerateWithFeedback(unit, verdict, engine);
      if (retried) {
        // Re-validate the retry
        const recheck = validator.validateUnit(retried);
        if (recheck.status === "pass") {
          plan = replaceUnit(plan, retried);
        } else {
          plan = revertToOriginal(plan, unit.source_id);
        }
      } else {
        plan = revertToOriginal(plan, unit.source_id);
      }
    }
  }

  // Build the integrity report
  const integrityReport = buildIntegrityReport(plan, validationResults, judgeResults);

  return { repositionPlan: plan, integrityReport };
}
```

---

## 4. Stage 7 — LLM Verifier (Judge)

### 4.1 Judge verdict schema

```typescript
// packages/repositioner-core/src/schemas/judge-verdict.schema.ts

const JudgeVerdictSchema = z.object({
  supported: z.boolean(),
  support_quote: z.string().nullable(),   // quote from source that supports the claim
  violation: z.string().nullable(),       // what went wrong, if not supported
});
```

### 4.2 Judge prompt

The judge is deliberately narrow and single-purpose. It sees only one bullet at a time.

```
SOURCE: "{original bullet text}"
REWRITE: "{rewritten bullet text}"

Is every factual claim in REWRITE fully supported by SOURCE? 
Consider: skills mentioned, metrics/numbers, scope of work, level of responsibility.

Reply with JSON only:
{
  "supported": true or false,
  "support_quote": "the exact phrase from SOURCE that supports the claim" or null,
  "violation": "what the REWRITE claims that SOURCE does not support" or null
}
```

**Temperature:** 0.0 (this is a binary judgement, no creativity needed).

### 4.3 What the judge catches that Stage 6 misses

- **Semantic inflation:** "worked on the project" → "led the project" (same entities, different claim).
- **Scope expansion:** "contributed to the migration" → "architected the migration".
- **Action upgrades:** "assisted with" → "drove", "managed".

These are subtle meaning shifts that a token-level check cannot detect but a language model can.

### 4.4 Retry-once-then-revert logic

```typescript
async function regenerateWithFeedback(
  unit: RepositionedBullet,
  verdict: JudgeVerdict,
  engine: LlmEngine,
): Promise<RepositionedBullet | null> {
  // Prompt: "Your previous rewrite was rejected because: {verdict.violation}.
  //          Please rewrite this bullet WITHOUT that issue.
  //          Original: {unit.original}"
  // If the retry also fails validation → return null (caller reverts to original)
}
```

---

## 5. Integrity report

The integrity report is the audit trail for the entire generation run. It powers the split integrity badge on the review screen.

```typescript
export interface IntegrityReport {
  ai_changes: {
    reworded: number;
    reordered: number;
    surfaced: number;       // latent skills promoted
    implied: string[];      // e.g., ["Node.js ← Express"]
    dropped: number;
    fabricated: 0;          // always 0 — the point of the system
  };
  user_changes: {
    attested_skills: string[];   // skill names the user attested
    edited_items: number;        // items the user edited in the inventory
  };
  validation_audit: {
    total_units: number;
    passed: number;
    failed_and_stripped: number;
    failed_and_reverted: number;
    judge_reviewed: number;
    judge_rejected_and_reverted: number;
  };
}
```

---

## 6. Verification checklist

- [ ] Stage 5 produces a `RepositionPlan` that validates against the Zod schema.
- [ ] Every bullet in the plan has a `source_id` that exists in the inventory.
- [ ] Every bullet has a `change_type` and `rationale`.
- [ ] Unchanged bullets from the inventory are backfilled if the LLM omits them.
- [ ] The Stage 6 → 7 pipeline correctly strips/reverts units that fail validation.
- [ ] The judge correctly identifies semantic inflation (e.g., "worked on" → "led").
- [ ] The retry-once-then-revert logic works: a failed retry reverts to the original bullet.
- [ ] The integrity report accurately counts all change types.
- [ ] `fabricated` is always 0 in the report (if it's not, the pipeline has a bug).
- [ ] Gap requirements from the match report do not appear anywhere in the generated output.
