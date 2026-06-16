# Phase 1 — Document Parsing & Candidate Inventory Extraction

**Spec references:** §5 Stages 1–2, §4 (architecture), §9 (LLM integration), §14 (risks)
**Depends on:** Nothing — this is the foundation.
**Produces:** A structured `CandidateInventory` JSON stored on the `Session`, ready for human review.

---

## 1. What this phase delivers

By the end of this phase you can upload a PDF or DOCX resume and receive back a fully structured Candidate Inventory with stable IDs on every item, confidence scores on uncertain extractions, and entity-level tagging (skills, tools, metrics, actions) on every bullet. The inventory is stored on the session row and the session status moves from `UPLOADED` → `PARSING` → `INVENTORY_REVIEW`.

---

## 2. Monorepo & package setup

Before any stage code, the monorepo scaffolding must exist.

### 2.1 Root workspace (`/`)
- Turborepo config (`turbo.json`) with `build`, `dev`, `lint` pipelines.
- Root `package.json` with `workspaces: ["apps/*", "packages/*"]`.
- Shared `tsconfig.base.json` (strict mode, `paths` pointing at packages).

### 2.2 `packages/repositioner-core`
This is the framework-agnostic library that owns all pipeline logic. It exposes typed functions; it has zero knowledge of NestJS, Express, or any HTTP framework.

```
packages/repositioner-core/
├── src/
│   ├── schemas/              # Zod schemas (shared contract)
│   │   ├── candidate-inventory.schema.ts
│   │   ├── job-requirements.schema.ts
│   │   ├── reposition-plan.schema.ts
│   │   └── judge-verdict.schema.ts
│   ├── interfaces/
│   │   ├── llm-engine.interface.ts      # extract(), rephrase(), judge()
│   │   ├── document-parser.interface.ts # parse(fileBuffer) → DoclingDocument
│   │   └── queue.interface.ts           # enqueue(phase, sessionId)
│   ├── stages/
│   │   ├── stage1-parse.ts
│   │   ├── stage2-extract-inventory.ts
│   │   └── ... (later phases add more)
│   ├── engines/
│   │   └── gemini.engine.ts             # LlmEngine implementation
│   ├── parsers/
│   │   ├── docling.parser.ts            # DocumentParser → Docling Serve HTTP
│   │   └── simple.parser.ts             # MVP stub: mammoth + pdf-parse
│   └── index.ts
├── package.json
└── tsconfig.json
```

### 2.3 `apps/api` (NestJS)
Thin controller layer. Controllers call into `repositioner-core` functions. No business logic here.

### 2.4 `apps/web` (Next.js)
Frontend app. Only the upload screen is built in this phase.

---

## 3. Zod schemas (the contract everything else types against)

### 3.1 `CandidateInventory` schema

This is the single most important type in the system. Define it as a Zod schema so it can be used for:
- LLM structured output validation (parse + retry on failure).
- API response typing.
- Frontend display typing.

```typescript
// packages/repositioner-core/src/schemas/candidate-inventory.schema.ts

const BulletEntitySchema = z.object({
  skills: z.array(z.string()),
  tools: z.array(z.string()),
  metrics: z.array(z.string()),     // verbatim metric strings: "reduced load time by 30%"
  actions: z.array(z.string()),     // verbs: "built", "optimised", "led"
});

const BulletSchema = z.object({
  id: z.string(),                   // stable: "b_01", "b_02", ...
  text: z.string(),                 // verbatim original bullet
  entities: BulletEntitySchema,
  confidence: z.number().min(0).max(1),
});

const ExperienceSchema = z.object({
  id: z.string(),                   // "exp_01"
  company: z.string(),
  title: z.string(),
  start: z.string(),                // "2023-02" (YYYY-MM)
  end: z.string().nullable(),       // null = "Present"
  bullets: z.array(BulletSchema),
  origin: z.enum(["extracted", "attested", "edited"]).default("extracted"),
});

const SkillSchema = z.object({
  id: z.string(),                   // "sk_01"
  name: z.string(),
  proficiency_stated: z.enum(["expert", "advanced", "intermediate", "beginner", "familiar", "none"]),
  confidence: z.number().min(0).max(1),
  origin: z.enum(["extracted", "attested", "edited"]).default("extracted"),
});

// ... similar for ProjectSchema, EducationSchema, CertificationSchema

const CandidateInventorySchema = z.object({
  contact: z.object({
    name: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
    links: z.array(z.string()),
  }),
  summary_raw: z.string().nullable(),
  experiences: z.array(ExperienceSchema),
  skills: z.array(SkillSchema),
  projects: z.array(ProjectSchema),
  education: z.array(EducationSchema),
  certifications: z.array(CertificationSchema),
});
```

> **Design decision — `confidence` field:** Every extracted item gets a `confidence` score (0–1) from the LLM. Items below a threshold (e.g., 0.7) are visually flagged in the inventory review UI so the user knows to double-check them. This is how we prevent silent mis-extractions from poisoning the source of truth.

> **Design decision — `origin` field:** Every item is tagged `extracted` by default. If the user edits it in Stage 2.5, it becomes `edited`. If the user adds it manually, it's `attested`. This tag flows through the entire pipeline to the split integrity badge.

---

## 4. Stage 1 — Document parse

### 4.1 The `DocumentParser` interface

```typescript
// packages/repositioner-core/src/interfaces/document-parser.interface.ts
export interface ParseResult {
  markdown: string;          // full document as clean markdown
  sections: Section[];       // structural breakdown (headings, body text)
  metadata: {
    pageCount: number;
    hasImages: boolean;
    detectedLayout: "single-column" | "multi-column" | "unknown";
    detectedFont: string | null;
  };
}

export interface DocumentParser {
  parse(fileBuffer: Buffer, mimeType: string): Promise<ParseResult>;
  healthCheck(): Promise<boolean>;
}
```

### 4.2 MVP implementation: `SimpleParser`

For the first build iteration, use lightweight Node libraries behind the same interface:
- **DOCX:** `mammoth` → extracts markdown from .docx files.
- **PDF:** `pdf-parse` → extracts text from text-layer PDFs.

This gets the pipeline end-to-end testable before Docling is deployed. The swap to Docling requires zero changes downstream.

```typescript
// packages/repositioner-core/src/parsers/simple.parser.ts
export class SimpleParser implements DocumentParser {
  async parse(fileBuffer: Buffer, mimeType: string): Promise<ParseResult> {
    if (mimeType === "application/pdf") {
      const data = await pdfParse(fileBuffer);
      return { markdown: data.text, sections: [], metadata: { ... } };
    }
    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const result = await mammoth.convertToMarkdown({ buffer: fileBuffer });
      return { markdown: result.value, sections: [], metadata: { ... } };
    }
    throw new Error(`Unsupported file type: ${mimeType}`);
  }
}
```

### 4.3 Production implementation: `DoclingParser`

Calls the Docling Serve container over HTTP.

```typescript
// packages/repositioner-core/src/parsers/docling.parser.ts
export class DoclingParser implements DocumentParser {
  constructor(private baseUrl: string) {} // e.g. "https://docling.fly.dev"

  async parse(fileBuffer: Buffer, mimeType: string): Promise<ParseResult> {
    // 1. Health-check before sending work
    // 2. POST multipart to Docling Serve /convert endpoint
    // 3. Map DoclingDocument JSON → ParseResult
    // 4. Timeout: 60s (Docling is slow on first parse after cold start)
  }
}
```

### 4.4 Docling Serve container

- **Image:** `ds4sd/docling-serve` (pinned version).
- **Local dev:** `docker-compose.yml` at repo root with a `docling` service on port 5001.
- **Production:** Deploy to Fly.io or Railway with scale-to-zero. Configure `min_machines = 0` on Fly.io to avoid idle cost, accepting ~30s cold start.
- **Health endpoint:** Call `/health` before enqueueing a parse job; if Docling is down, show user a "paste text instead" fallback.

---

## 5. Stage 2 — Candidate Inventory extraction

### 5.1 The `LlmEngine` interface

```typescript
// packages/repositioner-core/src/interfaces/llm-engine.interface.ts
export interface LlmEngine {
  /**
   * Extract structured data from resume text.
   * Returns a validated CandidateInventory.
   */
  extractInventory(resumeMarkdown: string): Promise<CandidateInventory>;

  /**
   * Parse a job description into structured requirements.
   */
  extractJobRequirements(jdText: string): Promise<JobRequirements>;

  /**
   * Generate a repositioned resume plan.
   */
  reposition(input: RepositionInput): Promise<RepositionPlan>;

  /**
   * Judge whether a rewritten bullet is fully supported by its source.
   */
  judge(original: string, rewritten: string): Promise<JudgeVerdict>;
}
```

### 5.2 Gemini engine implementation

```typescript
// packages/repositioner-core/src/engines/gemini.engine.ts
export class GeminiEngine implements LlmEngine {
  private client: GoogleGenAI;
  private model = "gemini-2.5-flash";  // confirm at build time

  constructor(private apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async extractInventory(resumeMarkdown: string): Promise<CandidateInventory> {
    // 1. Redact PII (name, email, phone) — store mapping for re-attachment
    // 2. Build system prompt with strict extraction rules
    // 3. Call Gemini with JSON response mode + the CandidateInventory schema
    // 4. Validate response against CandidateInventorySchema (Zod)
    // 5. Retry once on parse failure
    // 6. Re-attach PII to contact fields
    // 7. Return validated inventory
  }
}
```

**System prompt for extraction** (key rules):
- Extract conservatively. If unsure, set `confidence` low rather than guessing.
- Preserve verbatim text in `text` fields. Do not rephrase, summarise, or "improve" any bullet.
- If proficiency is not explicitly stated, set `proficiency_stated: "none"`.
- Generate stable, sequential IDs: `exp_01`, `b_01`, `sk_01`, etc.
- Extract entity tags (`skills`, `tools`, `metrics`, `actions`) from each bullet — these power the downstream validator.
- Set `confidence` to indicate extraction certainty (0.0–1.0). Ambiguous or partially-readable text → lower confidence.

**Temperature:** 0.0–0.1 (extraction is deterministic; we want consistency).

### 5.3 PII redaction module

```typescript
// packages/repositioner-core/src/utils/pii-redactor.ts
export interface RedactionMap {
  name: string;
  email: string;
  phone: string;
  employers: string[];  // company names
}

export function redact(text: string): { redacted: string; map: RedactionMap };
export function reattach(inventory: CandidateInventory, map: RedactionMap): CandidateInventory;
```

- Uses regex patterns to detect email addresses, phone numbers, and names (heuristic: first line or contact-section header).
- Replaces with placeholder tokens: `[REDACTED_NAME]`, `[REDACTED_EMAIL]`, etc.
- The `map` is stored in memory only (never sent to the LLM) and used to restore real values after extraction.
- **Enforced only in the `GeminiEngine`** adapter. A future `OllamaEngine` (local) can skip redaction since nothing leaves the machine.

### 5.4 The `stage2-extract-inventory.ts` orchestrator

```typescript
// packages/repositioner-core/src/stages/stage2-extract-inventory.ts
export async function extractInventory(
  parseResult: ParseResult,
  engine: LlmEngine,
): Promise<CandidateInventory> {
  const inventory = await engine.extractInventory(parseResult.markdown);
  // Post-processing:
  // - Deduplicate skills (same name appearing in bullets AND skills section)
  // - Normalize casing on skill names
  // - Sort experiences by date (most recent first)
  return inventory;
}
```

---

## 6. API endpoints (this phase only)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/sessions` | Upload resume (multipart), create session, store file in Supabase Storage, set status `UPLOADED` |
| `POST` | `/sessions/:id/job` | Attach JD text to the session |
| `POST` | `/sessions/:id/parse` | Enqueue Phase A via QStash |
| `GET` | `/sessions/:id` | Return session status + inventory (if ready) |
| `POST` | `/internal/phase-a/:id` | **QStash webhook.** Runs Stage 1 → Stage 2. Updates session with inventory JSON. Sets status `INVENTORY_REVIEW`. |

---

## 7. Database setup (Prisma + Supabase)

Set up the full Prisma schema in this phase even though later phases add no new tables — the spec's data model (§7) is small and self-contained.

- `User`, `Session`, `SynonymRule`, `ImplicationRule` — all as defined in the spec.
- `Session.status` is an enum: `UPLOADED | PARSING | INVENTORY_REVIEW | OPTIMISING | READY | FAILED`.
- `Session.expiresAt` is set on creation (default: 30 days from now) for POPIA compliance.
- Run initial migration against Supabase Postgres.

---

## 8. Test resume set

Before calling this phase done, assemble a small set of test resumes (3–5) covering the tricky cases:

| Resume | Tests |
|--------|-------|
| Clean single-column DOCX | Baseline; should extract perfectly |
| Multi-column PDF with skills sidebar | Tests Docling layout handling (SimpleParser will partially fail — expected) |
| PDF with tables (education, certs) | Tests table extraction |
| Minimal 1-page resume | Tests handling of sparse data (few bullets, no projects) |
| Dense 3-page resume | Tests performance and ID sequencing at scale |

Run each through the pipeline and manually verify the extracted inventory against the original. This set becomes the **regression corpus** — every future change to Stage 1 or 2 must pass it.

---

## 9. Verification checklist

- [ ] Upload a DOCX → `SimpleParser` extracts markdown → `GeminiEngine.extractInventory()` returns a valid `CandidateInventory` matching the Zod schema.
- [ ] Upload a text-layer PDF → same flow works.
- [ ] PII (name, email, phone) is redacted before the Gemini call and restored in the returned inventory.
- [ ] Every item has a stable ID (`exp_01`, `b_01`, `sk_01`).
- [ ] Bullets contain entity tags (`skills`, `tools`, `metrics`, `actions`).
- [ ] Low-confidence items have `confidence < 0.7`.
- [ ] Session status transitions: `UPLOADED → PARSING → INVENTORY_REVIEW`.
- [ ] Inventory is stored as JSON on the session row.
- [ ] The `DocumentParser` interface can swap between `SimpleParser` and `DoclingParser` via config with no downstream changes.
