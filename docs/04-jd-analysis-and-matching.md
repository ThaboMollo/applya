# Phase 4 — JD Analysis & Matching

**Spec references:** §5 Stages 3–4, §6 (gap handling)
**Depends on:** Phase 1 (inventory schema), Phase 3 (synonym/implication resolvers).
**Produces:** A structured `JobRequirements` model and a `MatchReport` classifying every requirement as covered, latent, or gap.

---

## 1. What this phase delivers

Two pipeline stages that bridge the inventory and generation:
- **Stage 3** parses the job description into structured requirements.
- **Stage 4** maps those requirements against the confirmed inventory to produce the match report — the data that drives both the generation strategy and the Honest Gaps panel.

---

## 2. Stage 3 — Job Requirements extraction

### 2.1 Zod schema

```typescript
// packages/repositioner-core/src/schemas/job-requirements.schema.ts

const JobRequirementsSchema = z.object({
  title: z.string(),                              // "Senior JavaScript Engineer"
  seniority: z.enum(["junior", "mid", "senior", "lead", "principal", "unspecified"]),
  must_have: z.array(z.string()),                  // hard requirements
  nice_to_have: z.array(z.string()),               // preferred/bonus
  responsibilities: z.array(z.string()),           // what the role does
  ats_keywords: z.array(z.string()),               // all extractable keywords
  soft_signals: z.array(z.string()),               // "fast-paced", "ownership"
});
```

### 2.2 LLM call

```typescript
// packages/repositioner-core/src/stages/stage3-jd-extraction.ts
export async function extractJobRequirements(
  jdText: string,
  engine: LlmEngine,
): Promise<JobRequirements> {
  return engine.extractJobRequirements(jdText);
}
```

**System prompt rules:**
- Extract requirements exactly as stated. Do not infer requirements the JD doesn't mention.
- Classify into `must_have` vs `nice_to_have` based on language cues ("required", "must have" vs "nice to have", "bonus", "preferred").
- `ats_keywords` should include all technology names, methodologies, and tools mentioned anywhere in the JD (superset of must_have + nice_to_have).
- `soft_signals` are culture/work-style indicators, not hard skills.
- Temperature: 0.0 (deterministic extraction).

### 2.3 API endpoint

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/sessions/:id/job` | Stores the raw JD text on the session. Can be called before or after Phase A. |

The JD text is stored on the session so Stage 3 can run as part of Phase B (after inventory confirmation). Stage 3 does not require the inventory — it can run in parallel with inventory review if desired, but for simplicity in the MVP it runs sequentially at the start of Phase B.

---

## 3. Stage 4 — Match & gap analysis

### 3.1 The three-bucket classification

For each requirement in `must_have` and `nice_to_have`, classify it against the confirmed inventory:

| Bucket | Meaning | What happens |
|--------|---------|-------------|
| **Covered** | The skill/requirement is explicitly listed in the inventory's `skills` section | Keep it, reorder it higher in the output |
| **Latent** | Evidence exists in a bullet or project (but not the skills section), OR the requirement is a curated implication of something in the inventory | **Surface it** — promote to the skills section, highlight in relevant bullets. This is the core value. |
| **Gap** | No evidence anywhere in the inventory — not in skills, not in bullets, not implied | Show in the **Honest Gaps panel** only. Never inject into the resume. |

### 3.2 Matching algorithm

The matcher runs a cascade of checks, from cheapest/most-precise to most-expensive/fuzziest:

```typescript
// packages/repositioner-core/src/stages/stage4-match.ts

export interface MatchResult {
  requirement: string;
  classification: "covered" | "latent" | "gap";
  sourceIds: string[];          // inventory item IDs that provide evidence
  matchRule: "exact" | "synonym" | "implication" | "semantic" | "none";
  confidence: number;
}

export async function matchRequirements(
  requirements: JobRequirements,
  inventory: CandidateInventory,
  synonymResolver: SynonymResolver,
  implicationRules: ImplicationRule[],
  engine: LlmEngine,              // only used for semantic fallback
): Promise<MatchReport> {
  const results: MatchResult[] = [];

  for (const req of [...requirements.must_have, ...requirements.nice_to_have]) {
    const result = await matchSingleRequirement(req, inventory, synonymResolver, implicationRules, engine);
    results.push(result);
  }

  return {
    results,
    matchScore: computeMatchScore(results, requirements),
  };
}
```

**Cascade per requirement:**

```typescript
async function matchSingleRequirement(req, inventory, synonymResolver, implicationRules, engine) {
  // Step 1: EXACT match in skills section
  const exactSkillMatch = inventory.skills.find(s =>
    s.name.toLowerCase() === req.toLowerCase()
  );
  if (exactSkillMatch) {
    return { classification: "covered", matchRule: "exact", sourceIds: [exactSkillMatch.id] };
  }

  // Step 2: SYNONYM match in skills section
  const synonymSkillMatch = inventory.skills.find(s =>
    synonymResolver.areSynonymous(s.name, req)
  );
  if (synonymSkillMatch) {
    return { classification: "covered", matchRule: "synonym", sourceIds: [synonymSkillMatch.id] };
  }

  // Step 3: EXACT or SYNONYM match in bullet entities (latent — exists but not surfaced)
  const bulletMatches = findInBulletEntities(req, inventory, synonymResolver);
  if (bulletMatches.length > 0) {
    return { classification: "latent", matchRule: "synonym", sourceIds: bulletMatches };
  }

  // Step 4: IMPLICATION match (latent — implied by something in the inventory)
  const implicationMatch = findImplication(req, inventory, implicationRules, synonymResolver);
  if (implicationMatch) {
    return { classification: "latent", matchRule: "implication", sourceIds: [implicationMatch.sourceId] };
  }

  // Step 5: SEMANTIC match via LLM (expensive, last resort)
  // Only for ambiguous cases like "ETL experience" ↔ "built data pipelines"
  const semanticMatch = await engine.semanticMatch(req, inventory);
  if (semanticMatch && semanticMatch.confidence > 0.8) {
    return { classification: "latent", matchRule: "semantic", sourceIds: semanticMatch.sourceIds };
  }

  // Step 6: No match → Gap
  return { classification: "gap", matchRule: "none", sourceIds: [] };
}
```

### 3.3 Match score computation

```typescript
function computeMatchScore(results: MatchResult[], requirements: JobRequirements): number {
  const mustHaveResults = results.filter(r => requirements.must_have.includes(r.requirement));
  const niceToHaveResults = results.filter(r => requirements.nice_to_have.includes(r.requirement));

  const mustHaveCoverage = mustHaveResults.filter(r => r.classification !== "gap").length / Math.max(mustHaveResults.length, 1);
  const niceToHaveCoverage = niceToHaveResults.filter(r => r.classification !== "gap").length / Math.max(niceToHaveResults.length, 1);

  // Weighted: must-haves count for 70%, nice-to-haves for 30%
  return Math.round((mustHaveCoverage * 0.7 + niceToHaveCoverage * 0.3) * 100);
}
```

The score counts both `covered` and `latent` (not gaps). This is important: latent skills the system can surface still count toward the match.

### 3.4 Match report schema

```typescript
// packages/repositioner-core/src/schemas/match-report.schema.ts

const MatchReportSchema = z.object({
  results: z.array(z.object({
    requirement: z.string(),
    classification: z.enum(["covered", "latent", "gap"]),
    sourceIds: z.array(z.string()),
    matchRule: z.enum(["exact", "synonym", "implication", "semantic", "none"]),
    confidence: z.number(),
  })),
  matchScore: z.number().min(0).max(100),
});
```

---

## 4. How this feeds downstream

The `MatchReport` is the instruction set for Stage 5 (generation):
- **Covered** items → reorder higher, use JD terminology.
- **Latent** items → surface into the skills section, emphasise in relevant bullets.
- **Gap** items → pass to the Honest Gaps panel, **never** mention in the resume.

---

## 5. Verification checklist

- [ ] Stage 3 correctly parses a JD into structured requirements with the right `must_have` vs `nice_to_have` split.
- [ ] Stage 4 exact matching: a skill named "React" in the inventory matches "React" in the JD → `covered`.
- [ ] Stage 4 synonym matching: "React.js" in inventory matches "React" in JD → `covered`.
- [ ] Stage 4 latent from bullets: "Docker" mentioned in a bullet entity but not in the skills section → `latent`.
- [ ] Stage 4 implication: "Express" in inventory, "Node.js" in JD → `latent` with `matchRule: "implication"`.
- [ ] Stage 4 gap: "Kubernetes" in JD, nowhere in inventory → `gap`.
- [ ] Match score weights must-haves at 70% and nice-to-haves at 30%.
- [ ] Gap items are never classified as latent or covered.
- [ ] The match report is stored on the session as `matchReport` JSON.
