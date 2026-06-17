# Applya — Architecture & Status Document

**Product:** FitCV — resume re-positioner. Re-orders, rephrases, and re-weights a resume against a target job. Never adds a fact not in the source resume.  
**Last updated:** 2026-06-17  
**Spec:** `resume-repositioner-spec.md` (canonical), `docs/` (derived summaries)

---

## 1. System topology

```
┌──────────────────────────────────────────────────────────────┐
│  USER BROWSER                                                │
│  Next.js 16 (React 19) — apps/web — port 3000               │
│  5 screens: Upload → Processing → Inventory → Review → Export│
└─────────────────────────┬────────────────────────────────────┘
                          │ REST + SSE
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  NestJS 10 API — apps/api — port 3001                        │
│  SessionsController  · InternalController                    │
│  SessionsService     · InternalService                       │
│  PrismaService (global)                                      │
└──────┬─────────────────┬────────────────┬────────────────────┘
       │                 │                │
       ▼                 ▼                ▼
┌────────────┐  ┌─────────────┐  ┌──────────────────────────┐
│  Supabase  │  │  Upstash    │  │  repositioner-core        │
│  Postgres  │  │  QStash     │  │  (pure TS library)        │
│  Storage   │  │  (job queue)│  │  Stages 1–8               │
│  (Auth—    │  │             │  │                           │
│  deferred) │  └──────┬──────┘  └──────────────────────────┘
└────────────┘         │
                       │ HTTP POST (webhook delivery)
                       ▼
              POST /internal/phase-a/:id
              POST /internal/phase-b/:id
              (same NestJS API — loopback in dev)

                       │ (Phase A only)
                       ▼
              ┌─────────────────────┐
              │  Docling Serve      │
              │  Python container   │
              │  quay.io image      │
              │  NOT YET HOSTED     │
              │  (MVP stub active)  │
              └─────────────────────┘

                       │ (Stages 2,3,5,7)
                       ▼
              ┌─────────────────────┐
              │  Google Gemini API  │
              │  gemini-2.5-flash   │
              │  AI Studio free tier│
              └─────────────────────┘
```

---

## 2. Hosting topology

| Service | Host | Status | Notes |
|---|---|---|---|
| Frontend (Next.js) | Local dev / Vercel (TBD) | ✅ Running locally | Not deployed to Vercel yet |
| API (NestJS) | Local dev / Vercel (TBD) | ✅ Running locally | Not deployed to Vercel yet |
| Queue | Upstash QStash | ✅ Configured | Dev bypass active — no ngrok needed locally |
| Document parser | Docling Serve (Railway) | ❌ Not hosted | Railway OOM at 1GB; needs 4GB plan. MVP stub active |
| Database | Supabase Postgres | ✅ Live | Schema pushed, allowlists seeded |
| File storage | Supabase Storage | ✅ Bucket created | Bucket: `sessions` (private) |
| Auth | Supabase Auth | ❌ Not wired | Pilot user hardcoded via `PILOT_USER_EMAIL` |
| LLM | Google AI Studio | ✅ Connected | Key verified, gemini-2.5-flash |

---

## 3. Monorepo package structure

```
applya/
├── apps/
│   ├── api/                         NestJS backend
│   │   └── src/
│   │       ├── app.module.ts        ✅ Wired (ConfigModule, PrismaModule global)
│   │       ├── main.ts              ✅ CORS, ValidationPipe, port 3001
│   │       ├── prisma/
│   │       │   ├── prisma.service.ts   ✅ Injectable PrismaClient
│   │       │   └── prisma.module.ts    ✅ Global module
│   │       ├── sessions/
│   │       │   ├── sessions.controller.ts  ✅ All 12 routes
│   │       │   ├── sessions.service.ts     ✅ Fully implemented
│   │       │   └── dto/                    ✅ AttachJob, PatchInventory, PatchDecisions, Export
│   │       └── internal/
│   │           ├── internal.controller.ts  ✅ /phase-a/:id, /phase-b/:id
│   │           └── internal.service.ts     ✅ Phase A + Phase B fully implemented
│   │
│   └── web/                         Next.js 16 frontend
│       └── src/
│           ├── app/
│           │   ├── layout.tsx               ✅ Geist font, metadata
│           │   ├── globals.css              ✅ Full design system (CSS variables)
│           │   ├── page.tsx                 ✅ Upload screen
│           │   └── sessions/[id]/
│           │       ├── processing/page.tsx  ✅ SSE + polling, step indicators
│           │       ├── inventory/page.tsx   ✅ Review, attest, confirm
│           │       ├── review/page.tsx      ✅ Diff, accept/reject/edit, integrity badge
│           │       └── export/page.tsx      ✅ Template gallery, DOCX + PDF download
│           └── lib/
│               └── api.ts                  ✅ Full API client + TypeScript types
│
├── packages/
│   ├── repositioner-core/           Framework-agnostic pipeline library
│   │   └── src/
│   │       ├── index.ts             ✅ All exports
│   │       ├── schemas/
│   │       │   ├── inventory.schema.ts       ✅ CandidateInventory (Zod)
│   │       │   ├── job-model.schema.ts       ✅ JobModel + MatchReport (Zod)
│   │       │   └── reposition-plan.schema.ts ✅ RepositionPlan + IntegrityReport (Zod)
│   │       ├── allowlists/
│   │       │   ├── synonyms.ts       ✅ 54 groups, buildSynonymLookup()
│   │       │   └── implications.ts   ✅ 22 rules, getImpliedSkills()
│   │       ├── interfaces/
│   │       │   ├── llm-engine.interface.ts  ✅ LlmEngine
│   │       │   └── parser.interface.ts      ✅ DocumentParser
│   │       ├── engine/
│   │       │   └── gemini.engine.ts  ✅ All 5 methods + PII redaction
│   │       ├── parser/
│   │       │   └── index.ts          ✅ MvpStubParser (active) + DoclingClient (ready)
│   │       ├── validator/
│   │       │   ├── index.ts          ✅ Stage 6 — full entity + numeric + proficiency checks
│   │       │   └── validator.spec.ts ✅ 29 tests, all passing
│   │       └── renderer/
│   │           ├── content-assembler.ts  ✅ Assembles plan + decisions → content
│   │           ├── docx.renderer.ts      ✅ 3 templates (Classic, Modern, Compact)
│   │           ├── pdf.renderer.ts       ✅ 3 templates (pdfkit)
│   │           └── index.ts              ✅ Renderer class
│   │
│   └── database/                    Prisma schema + client
│       ├── prisma/
│       │   ├── schema.prisma   ✅ Pushed to Supabase
│       │   └── seed.ts         ✅ Seeds synonym + implication allowlists
│       └── src/
│           └── index.ts        ✅ Exports PrismaClient, Status enum, model types
│
├── docling/
│   ├── fly.toml       ⚠️  Documented but Fly.io has 8GB image size limit — not usable
│   └── railway.json   ⚠️  Railway config exists; needs 4GB memory plan
│
└── docker-compose.yml  ✅ Local Docling Serve (optional local fallback)
```

---

## 4. Pipeline stages — implementation status

| Stage | Directory | What it does | Status |
|---|---|---|---|
| 1 — Document parse | `parser/index.ts` | PDF/DOCX → plain text | ✅ MVP stub active (mammoth/pdf-parse). DoclingClient implemented, awaiting hosted instance |
| 2 — Inventory extraction | `engine/gemini.engine.ts` → `extractInventory()` | LLM → CandidateInventory JSON | ✅ Implemented. PII redacted before Gemini call |
| 2.5 — Human gate | `sessions.service.ts` → `confirmInventory()` | User reviews + confirms inventory | ✅ Implemented. Hard gate: Phase B blocked until `inventoryConfirmed = true` |
| 3 — JD model | `engine/gemini.engine.ts` → `parseJobModel()` | LLM → JobModel JSON | ✅ Implemented |
| 4 — Match + gap | `internal.service.ts` → `runMatchAnalysis()` | Deterministic coverage: covered / latent / gap | ✅ Implemented. Synonym + implication lookup, LLM for ambiguous cases |
| 5 — Re-positioning | `engine/gemini.engine.ts` → `repositionResume()` | LLM → RepositionPlan (every unit has source_id) | ✅ Implemented. Constrained prompt, 0.3 temperature |
| 6 — Programmatic validator | `validator/index.ts` | Deterministic entity + metric + proficiency check | ✅ Fully implemented. 29 unit tests passing |
| 7 — LLM verifier | `engine/gemini.engine.ts` → `verifyUnit()` | Per-bullet semantic check → revert if unsupported | ✅ Implemented. Runs on all non-unchanged bullets |
| 8 — Render | `renderer/` | Assemble plan + decisions → DOCX + PDF | ✅ Implemented. 3 templates, auto-renders in Phase B |

---

## 5. API routes — implementation status

| Method | Route | Service method | Status |
|---|---|---|---|
| POST | `/sessions` | `create()` | ✅ Multipart upload → Supabase Storage → DB → enqueue Phase A |
| POST | `/sessions/:id/job` | `attachJob()` | ✅ Saves JD text to session |
| POST | `/sessions/:id/parse` | `enqueuePhaseA()` | ✅ Re-triggers Phase A |
| GET | `/sessions/:id` | `findOne()` | ✅ Returns full session + all reports |
| GET | `/sessions/:id/stream` | `streamStatus()` | ✅ SSE via RxJS Subject |
| GET | `/sessions/:id/inventory` | `getInventory()` | ✅ Returns inventory + confirmed flag |
| PATCH | `/sessions/:id/inventory` | `patchInventory()` | ✅ Edits + attestations (origin tracked) |
| POST | `/sessions/:id/inventory/confirm` | `confirmInventory()` | ✅ Freezes inventory, enqueues Phase B |
| PATCH | `/sessions/:id/decisions` | `patchDecisions()` | ✅ Saves per-bullet accept/reject/edit |
| GET | `/sessions/:id/templates` | `getTemplates()` | ✅ Returns 3 templates + default |
| POST | `/sessions/:id/export` | `export()` | ✅ Re-renders with chosen template → uploads DOCX + PDF |
| GET | `/sessions/:id/download/:format` | `getDownloadUrl()` | ✅ Returns signed Supabase Storage URL (1hr) |
| DELETE | `/sessions/:id` | `remove()` | ✅ Deletes session + storage files (POPIA wipe) |
| POST | `/internal/phase-a/:id` | `runPhaseA()` | ✅ QStash webhook. Dev bypass: no signature required |
| POST | `/internal/phase-b/:id` | `runPhaseB()` | ✅ QStash webhook. Dev bypass: no signature required |

---

## 6. Frontend screens — implementation status

| Screen | Route | Status | Notes |
|---|---|---|---|
| Upload | `/` | ✅ Complete | File drag-and-drop, JD textarea, validation |
| Processing | `/sessions/[id]/processing` | ✅ Complete | SSE + 3s poll fallback, Phase A + B step indicators, auto-redirect |
| Inventory review | `/sessions/[id]/inventory` | ✅ Complete | Confidence dots, attestation input, sticky confirm CTA |
| Diff + review | `/sessions/[id]/review` | ✅ Complete | Side-by-side diff, accept/reject/edit, match score ring, integrity badge, honest gaps |
| Export | `/sessions/[id]/export` | ✅ Complete | Template gallery with previews, DOCX + PDF download |
| Session redirect | `/sessions/[id]` | ❌ Missing | No base route — navigating directly 404s |

---

## 7. Communication map

```
Frontend (3000)
    │
    ├──► POST /sessions              multipart/form-data
    ├──► POST /sessions/:id/job      JSON
    ├──► GET  /sessions/:id          JSON poll
    ├──► GET  /sessions/:id/stream   SSE (EventSource)
    ├──► GET  /sessions/:id/inventory
    ├──► PATCH /sessions/:id/inventory
    ├──► POST /sessions/:id/inventory/confirm
    ├──► PATCH /sessions/:id/decisions
    ├──► GET  /sessions/:id/templates
    ├──► POST /sessions/:id/export
    └──► GET  /sessions/:id/download/:format

API (3001)
    │
    ├──► Supabase Postgres        (Prisma — pooled via PgBouncer port 6543)
    ├──► Supabase Storage         (@supabase/supabase-js — service role key)
    ├──► Upstash QStash           (@upstash/qstash — publish to /internal/*)
    ├──► Google Gemini API        (@google/genai — extractInventory, parseJobModel,
    │                              semanticMatch, repositionResume, verifyUnit)
    └──► Docling Serve            (fetch — POST /v1alpha/convert/source)
                                   ⚠️  Currently: MvpStubParser (no external call)

QStash (production)
    └──► POST /internal/phase-a/:id   → API (verified via upstash-signature header)
    └──► POST /internal/phase-b/:id   → API (verified via upstash-signature header)

QStash (dev bypass)
    └──► API calls itself via fetch (fire-and-forget, no signature required)
```

---

## 8. Data model

```
User ──< Session >── inventory (Json)        CandidateInventory
                 >── jobModel (Json)          JobModel
                 >── matchReport (Json)       MatchReport
                 >── repositionPlan (Json)    RepositionPlan
                 >── integrityReport (Json)   IntegrityReport
                 >── userDecisions (Json)     Record<sourceId, Decision>
                 >── resumeFileKey            Supabase Storage key
                 >── outputDocxKey            Supabase Storage key
                 >── outputPdfKey             Supabase Storage key

SynonymGroup    — 54 rows seeded (React ⇄ React.js ⇄ ReactJS, etc.)
ImplicationRule — 22 rows seeded (Express ⇒ Node.js, NestJS ⇒ TypeScript, etc.)

Session status flow:
  UPLOADED → PARSING → INVENTORY_REVIEW → OPTIMISING → READY → FAILED
```

---

## 9. Environment variables

| Variable | Location | Status | Purpose |
|---|---|---|---|
| `DATABASE_URL` | api + database | ✅ Set | Supabase pooled (port 6543) |
| `DIRECT_URL` | api + database | ✅ Set | Supabase session pooler (port 5432) |
| `SUPABASE_URL` | api | ✅ Set | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | api | ✅ Set | Service role key (server-side only) |
| `GEMINI_API_KEY` | api | ✅ Set + verified | Google AI Studio key |
| `QSTASH_URL` | api | ✅ Set | Upstash publish endpoint |
| `QSTASH_TOKEN` | api | ✅ Set | Upstash auth token |
| `QSTASH_CURRENT_SIGNING_KEY` | api | ✅ Set | Webhook verification |
| `QSTASH_NEXT_SIGNING_KEY` | api | ✅ Set | Webhook verification |
| `DOCLING_SERVE_URL` | api | ❌ Empty | Set to hosted URL when Docling Serve is running |
| `FRONTEND_URL` | api | ✅ Set | CORS origin (http://localhost:3000) |
| `BASE_URL` | api | ✅ Set | API's own URL for QStash delivery (http://localhost:3001) |
| `PILOT_USER_EMAIL` | api | ✅ Set | Hardcoded pilot user (replaces real auth) |
| `NEXT_PUBLIC_SUPABASE_URL` | web | ✅ Set | Client-side Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | ✅ Set | Client-side anon key |
| `NEXT_PUBLIC_API_URL` | web | ✅ Set | API base URL for frontend |

---

## 10. Status checklist

### ✅ Done — working and connected
- [x] Zod schemas (inventory, job-model, reposition-plan)
- [x] Synonym allowlist (54 groups, in-memory + seeded to DB)
- [x] Implication allowlist (22 rules, in-memory + seeded to DB)
- [x] Prisma schema pushed to Supabase
- [x] Stage 6 validator — entity, numeric, proficiency checks (29 tests)
- [x] Stage 1 parser — MVP stub (mammoth + pdf-parse)
- [x] DoclingClient — implemented, awaiting hosted Docling Serve
- [x] GeminiEngine — all 5 methods (extractInventory, parseJobModel, semanticMatch, repositionResume, verifyUnit)
- [x] PII redaction before every Gemini call
- [x] Stage 4 match/gap analysis — deterministic (synonym + implication) + LLM for ambiguous
- [x] Stage 8 renderer — DOCX + PDF, 3 templates (Classic, Modern, Compact)
- [x] Phase A pipeline (Stages 1 + 2 → INVENTORY_REVIEW)
- [x] Phase B pipeline (Stages 3–8 → READY)
- [x] Inventory human gate — `inventoryConfirmed` hard-blocks Phase B
- [x] QStash two-phase flow (production)
- [x] Dev-mode direct call bypass (no ngrok needed locally)
- [x] SessionsService — all 13 methods fully implemented
- [x] Supabase Storage — upload/download/delete/signed URLs
- [x] POPIA wipe endpoint (DELETE /sessions/:id)
- [x] All 5 frontend screens
- [x] SSE status stream + polling fallback
- [x] Template gallery + DOCX/PDF export flow
- [x] yarn db:generate / db:push / db:seed / db:migrate aliases

### ⚠️ Partially done — exists but not fully connected
- [ ] Docling Serve — DoclingClient implemented; service needs hosting with ≥4GB RAM (Railway paid plan)
- [ ] QStash production delivery — configured, but `BASE_URL` still points to localhost (needs Vercel URL after deploy)
- [ ] Stage 7 verifier scope — runs on all reworded bullets; should skip unchanged to save quota

### ❌ Not yet built — required for pilot
- [ ] Supabase Auth (invite-only magic link) — currently hardcoded pilot user
- [ ] POPIA TTL cleanup job — `expiresAt` set on sessions but nothing runs the delete
- [ ] `/sessions/[id]` base route — no redirect; navigating directly 404s
- [ ] File upload size limit — no `limits: { fileSize }` in Multer config

### 🔜 Deferred (spec §13)
- [ ] Vercel deployment (frontend + API)
- [ ] Docling Serve hosted with adequate memory
- [ ] Real auth replacing pilot user
- [ ] Job URL scraping (v2)
- [ ] Cover letter generation
- [ ] Monetisation / billing
- [ ] tseboIQ integration

---

## 11. Local dev startup

```bash
# Terminal 1 — API
yarn workspace @applya/api dev          # NestJS on :3001

# Terminal 2 — Frontend
yarn workspace web dev                  # Next.js on :3000

# Tests
yarn workspace @applya/repositioner-core test

# DB
yarn db:generate    # regenerate Prisma client
yarn db:push        # push schema changes to Supabase
yarn db:seed        # re-seed allowlists
yarn db:studio      # open Prisma Studio

# Manual pipeline trigger (dev — no QStash needed)
curl -X POST http://localhost:3001/internal/phase-a/<sessionId>
curl -X POST http://localhost:3001/internal/phase-b/<sessionId>
```

---

## 12. Anti-fabrication layers (the product guarantee)

| Layer | Mechanism | Status |
|---|---|---|
| 1 | Human inventory review gate (Stage 2.5) | ✅ |
| 2 | Synonym allowlist — normalises React.js ⇄ React | ✅ |
| 3 | Implication allowlist — Express ⇒ Node.js (curated only) | ✅ |
| 4 | Stage 6 deterministic validator — every entity must trace to inventory | ✅ |
| 5 | Stage 7 LLM judge — semantic inflation check per bullet | ✅ |

**Split integrity badge** — AI changes and user changes reported separately. `fabricated: 0` is the headline guarantee.
