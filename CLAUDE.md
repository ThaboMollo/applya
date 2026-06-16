# Applya — Codebase Guide for Implementing Agents

**Product:** Resume re-positioner. Re-orders, rephrases, and re-weights a resume against a target job. Never adds a fact not already in the source resume.

**Full spec:** `resume-repositioner-spec.md` — read it before touching the pipeline. The architecture plans in `docs/` are derived summaries.

---

## Package manager

**Use yarn, not npm.** Always `yarn add`, `yarn install`, `yarn workspace <name> <command>`.

```bash
yarn install                          # install all workspaces
yarn workspace @applya/api add <pkg>  # add dep to a specific workspace
yarn dev                              # run all in parallel via turbo
yarn test                             # run all tests via turbo
yarn db:generate                      # regenerate Prisma client
yarn db:seed                          # seed synonym + implication allowlists
```

---

## Monorepo structure

```
apps/
  web/          Next.js 16 frontend (Vercel)     — package: web
  api/          NestJS backend (Vercel serverless) — package: @applya/api
packages/
  repositioner-core/  Framework-agnostic pipeline library — package: @applya/repositioner-core
  database/           Prisma schema + client      — package: @applya/database
docs/                 Architecture plans (read-only reference)
resume-repositioner-spec.md   CANONICAL SPEC — read first
```

### Key rule from spec §15
**Pipeline is a library, not the app.** All Stages 1–8 live in `packages/repositioner-core`. The NestJS controllers in `apps/api` are a thin delegation layer. Zero business logic in controllers.

---

## Tech stack (all decided — do not change without spec justification)

| Concern | Choice |
|---|---|
| Frontend | Next.js 16 (breaking changes vs prior — read AGENTS.md in apps/web) |
| Backend API | NestJS 10 on Vercel serverless functions |
| Queue | Upstash QStash (HTTP-delivered jobs; replaces BullMQ — Vercel has no persistent workers) |
| Document parsing | Docling Serve (Python container on Fly.io/Railway). MVP stub: mammoth + pdf-parse |
| Database | Supabase (Postgres) via Prisma |
| File storage | Supabase Storage |
| Auth | Supabase Auth (invite-only magic link for pilot) |
| LLM | Google AI Studio — Gemini Flash (free tier). Model: `gemini-2.5-flash` or `flash-lite` |
| LLM SDK | `@google/genai` |
| Schema validation | Zod (all LLM outputs validated against Zod schemas) |
| DOCX output | `docx` package |

---

## Build order (from spec §16 — follow this exactly)

1. **Phase A pipeline** (packages/repositioner-core): Stage 1 (parser stub) + Stage 2 (inventory extraction) + Zod schemas. Get extraction trustworthy first.
2. **Inventory review gate** (Stage 2.5): `PATCH /sessions/:id/inventory` + `POST /sessions/:id/inventory/confirm`. The human checkpoint everything downstream trusts.
3. **Stage 6 validator** in isolation with unit tests — seed synonym + implication allowlists first. Prove the guarantee before generation sits on top.
4. **Stages 3–4**: JD model + match/gap analysis.
5. **Stage 5**: re-positioning generation (gated by Stage 6 + 7).
6. **Stage 8**: render (DOCX + PDF) with template gallery.
7. **Review UI + diff screen** + split integrity badge.
8. **Wire QStash two-phase flow** + Supabase Auth + POPIA retention + export.

---

## The pipeline stages (packages/repositioner-core/src/)

| Stage | Directory | Status |
|---|---|---|
| 1 — Document parse | `parser/` | Stub (mammoth/pdf-parse). Swap to DoclingClient when container is running. |
| 2 — Inventory extraction | `extractor/` | TODO |
| 2.5 — Human gate | API layer (`sessions.controller.ts`) | TODO |
| 3 — JD model | `job-model/` | TODO |
| 4 — Match + gap | `matcher/` | TODO |
| 5 — Re-positioning | `rephraser/` | TODO |
| 6 — Validator | `validator/index.ts` | **Skeleton exists** — flesh out entity extraction + full test suite |
| 7 — LLM verifier | `verifier/` | TODO |
| 8 — Render | `renderer/` | TODO |

---

## Anti-fabrication layers (NON-NEGOTIABLE — this is the product)

The spec §1 defines the guarantee. The layers enforce it:

1. **Stage 2.5 human gate** — user confirms the extracted inventory before any generation. Prevents parser misses becoming silent fabrications. `inventoryConfirmed` must be `true` to enqueue Phase B.
2. **Synonym allowlist** (`src/allowlists/synonyms.ts`) — normalises React.js ↔ React without inventing new terms. Seeded; grows from pilot cases.
3. **Implication allowlist** (`src/allowlists/implications.ts`) — near-certain-only rules (Express ⇒ Node.js). Each rule has a `note` justifying it. **Never use LLM output to expand this list.**
4. **Stage 6 validator** (`src/validator/index.ts`) — deterministic TypeScript, fully unit-testable. Every entity in every rewritten bullet must be: in inventory, a curated implication, or user-attested. Numbers must appear verbatim in cited source. Proficiency upgrades are blocked.
5. **Stage 7 LLM judge** — narrow per-bullet call: "Is every claim supported by the source?" `supported: false` → regenerate once or revert.

Stage 6 is the most critical file to implement correctly. Write the unit tests before the logic.

---

## Zod schemas (the data contract — already defined)

```
packages/repositioner-core/src/schemas/
  inventory.schema.ts      — CandidateInventory (Stage 2 output)
  job-model.schema.ts      — JobModel + MatchReport (Stage 3/4 output)
  reposition-plan.schema.ts — RepositionPlan + IntegrityReport (Stage 5/6 output)
```

All LLM responses MUST be parsed through these schemas. Reject + retry once on parse failure.

---

## LLM usage rules

- **Model:** Gemini Flash only (confirmed free tier model: `gemini-2.5-flash` or `flash-lite` — verify in AI Studio at build time, Google changes these).
- **SDK:** `@google/genai` — already listed as a dep in `packages/repositioner-core/package.json`.
- **Structured output:** use Gemini's response schema / JSON mode. Never accept free-text and parse manually.
- **Temperature:** 0–0.1 for extraction/validation/judgement. 0.3 max for rewriting (Stage 5).
- **Token limits:** set output token limits sized to the schema.
- **Cost guard:** API key must be on a GCP project with NO billing account attached.

### PII REDACTION — mandatory for hosted engines

Before any text is sent to Gemini, call `redactPii()` from `src/engine/gemini.engine.ts`:
- Strips: name, email, phone, LinkedIn/GitHub URLs.
- Re-attach identity locally at Stage 8 render using the original session contact data.
- `OllamaEngine` (local) may skip redaction.
- This rule is enforced in the engine adapter — the stages don't need to know about it.

---

## Database

**Package:** `@applya/database` (packages/database)  
**Schema:** `packages/database/prisma/schema.prisma`  
**Connection:** Two Supabase URLs required:
- `DATABASE_URL` — pooled (port 6543, for runtime queries)
- `DIRECT_URL` — direct (port 5432, for migrations)

**Session status flow:** `UPLOADED → PARSING → INVENTORY_REVIEW → OPTIMISING → READY → FAILED`

**Phase B gate:** `inventoryConfirmed: true` must be asserted before Phase B is enqueued. The `confirmInventory()` service method is the only place that sets this + enqueues Phase B.

**Allowlist tables:** `SynonymGroup` and `ImplicationRule` in Prisma schema. Seed via `yarn db:seed` which reads from the in-memory lists in `repositioner-core/src/allowlists/`.

---

## API routes (NestJS — apps/api)

Full contract in spec §8. Controller stubs exist in `src/sessions/sessions.controller.ts`.

**QStash webhooks** (internal, not user-facing):
- `POST /internal/phase-a/:id` — runs Stages 1 + 2
- `POST /internal/phase-b/:id` — runs Stages 3–8

Verify the `upstash-signature` header before processing. Use `@upstash/qstash` Receiver for verification.

---

## Frontend (apps/web)

Next.js 16 — **read the AGENTS.md in apps/web** before writing any frontend code. This version has breaking changes vs prior Next.js.

Key screens:
1. **Upload screen** — file upload + JD text paste
2. **Inventory review screen** (Stage 2.5 gate) — grouped display, confidence flags, inline edit, attestation control, Confirm button (disabled until reviewed)
3. **Processing screen** — SSE progress from `GET /sessions/:id/stream`
4. **Review + diff screen** — side-by-side diff, accept/reject per bullet, split integrity badge, Honest Gaps panel, match score
5. **Template picker** — ~3 ATS-safe templates, smart default
6. **Export** — DOCX + PDF download

---

## Environment variables needed

```bash
# apps/api and packages/database
DATABASE_URL=          # Supabase pooled connection string
DIRECT_URL=            # Supabase direct connection string
SUPABASE_URL=          # Supabase project URL
SUPABASE_SERVICE_KEY=  # Supabase service role key (server-side only)
GEMINI_API_KEY=        # Google AI Studio API key (NO billing account)
QSTASH_URL=            # Upstash QStash publish URL
QSTASH_TOKEN=          # Upstash QStash token
QSTASH_CURRENT_SIGNING_KEY=  # For webhook signature verification
QSTASH_NEXT_SIGNING_KEY=     # For webhook signature verification
DOCLING_SERVE_URL=     # Docling Serve container URL (leave unset to use MVP stub)
FRONTEND_URL=          # e.g. http://localhost:3000 or https://fitcv.vercel.app

# apps/web
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=
```

Create `.env.local` files (never commit them). Copy `.env.example` as a template.

---

## Testing priorities

1. **Stage 6 validator unit tests** — must cover:
   - Invented skill → fail
   - Synonym-normalised skill → pass (React.js === React)
   - Curated implication → pass (Express ⇒ Node.js)
   - User-attested skill → pass
   - Invented metric → fail
   - Verbatim metric from source → pass
   - Proficiency upgrade → fail
   - Unchanged proficiency → pass
2. **Inventory confirmation gate** — integration test: Phase B cannot be enqueued without `inventoryConfirmed: true`.
3. **Stage 7 verifier** — unit tests with mocked LLM.

---

## Pilot scope (what to build, what to defer)

**Build now:**
- Full 8-stage pipeline with all integrity layers (non-negotiable)
- Inventory review gate with edit + attestation
- Diff review with accept/reject + direct edit
- Template gallery (~3) + DOCX + PDF export
- Supabase Auth (invite-only magic link)
- POPIA: auto-delete TTL + user wipe endpoint

**Defer to wider pilot / tseboIQ:**
- Job URL scraping (v2)
- Monetization / billing
- Cover letter generation
- LinkedIn optimisation
- Multi-language support (pilot is English-only)

---

## Common pitfalls to avoid

- **Don't enqueue Phase B without `inventoryConfirmed: true`** — hard gate.
- **Don't expand implication or synonym allowlists with LLM output** — curated data only.
- **Don't send unredacted PII to Gemini** — call `redactPii()` before every prompt.
- **Don't put business logic in NestJS controllers** — it belongs in `repositioner-core`.
- **Don't use BullMQ** — there's no persistent worker on Vercel. Use Upstash QStash.
- **Don't pixel-reproduce the original resume's design** — approximate via the closest template gallery entry and set user expectations in the UI.
- **Seed the allowlists before first run** — an empty list makes Stage 6 flag all synonyms as fabrications.
