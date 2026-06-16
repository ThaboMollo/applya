# Resume Re-Positioner — Implementation Spec

**Working name:** TBD (placeholder: *FitCV*)
**Author:** Thabo Mponya
**Status:** Draft v1 — implementation planning
**Last updated:** 2026-06-16

---

## 1. The one principle everything else serves

> The app **re-positions** an existing resume against a target job. It **never adds a fact that isn't already in the source resume.**

This is a *content-integrity* product before it is a *generation* product. The valuable, defensible thing here is the guarantee. Anyone can wire a resume + a JD into an LLM and get a "tailored resume" back — and that output will routinely lie on the candidate's behalf (invented metrics, inflated proficiency, skills the JD asked for but the person never claimed). Those lies get people caught in interviews and screened out by honest recruiters.

So the system's job is narrowly defined. Given the source resume, the model may only:

- **Reorder** experiences, bullets, and skills by relevance to the job.
- **Rephrase** existing bullets to use the job's terminology and surface the relevant angle of a real accomplishment.
- **Re-weight** — promote a buried-but-relevant project, demote an irrelevant one.
- **Re-summarise** — write a targeted professional summary using only facts already present.
- **Surface latent skills** — promote a skill that already appears in a bullet or project into the Skills section when the role calls for it (e.g. "containerised the service with Docker" → add **Docker** to Skills). This is the core "highlight what they already have" behaviour.
- **Normalise terminology** — map "React.js" ⇄ "ReactJS" ⇄ "React" via a controlled synonym list (never free invention).
- **Apply strict, curated implications** — e.g. "built REST APIs in **Express**" ⇒ **Node.js** — but *only* via a conservative, audited implication list (§6), never free LLM inference.

It may **never**:

- Add a skill, tool, certification, employer, title, or responsibility that is neither in the source, a curated implication of something in the source, nor user-attested.
- Invent or alter any number, metric, percentage, date, or duration.
- Upgrade a stated proficiency ("familiar with" → "expert in").
- Imply experience the candidate didn't claim.

**Two deliberate, honest expansions of the source of truth:**

1. **Inventory review (human gate).** Before any optimisation runs, the user **reviews and confirms** the extracted inventory — correcting parser misreads and, if they wish, **attesting** to a real skill the parser missed ("I confirm this is true"). The pipeline does not generate until the inventory is confirmed.
2. **Direct edits.** The user may edit output text on the review screen.

The AI's own guarantee is unchanged — *it* never fabricates. What changes is that the source of truth becomes **the original document + the curated implication list + whatever the user explicitly vouches for.** AI-authored and user-authored content are tracked and displayed **separately**, so trust is never blurred (see the split integrity badge, §6).

Everything below is architecture in service of enforcing that boundary.

---

## 2. Why this is hard (and how we win)

The naive build — "stuff resume + JD into one prompt, return tailored resume" — fails because the model has no mechanical constraint preventing fabrication. Prompting alone ("don't make things up") reduces but does **not** eliminate it. We win by making fabrication *structurally* hard at independent layers, so a slip at one layer is caught at the next:

1. **Source-of-truth extraction** — the original resume is parsed into a structured *Candidate Inventory*. Once the user confirms it (layer 2), it is frozen and becomes the allowlist of everything the candidate may claim — extended only by the curated implication list and explicit user attestations.
2. **Human review gate** — the user reviews and confirms the inventory before any generation, correcting parser misses and attesting to real-but-missed skills. This stops the worst failure mode: a mis-extraction silently becoming either a fabrication or a stripped real skill.
3. **Constrained generation** — the model is given the confirmed inventory and required to emit, for every output bullet/skill, a `source_id` pointing back to the inventory item (or implication/attestation) it derives from. No traceable source → not allowed.
4. **Programmatic validation** — a deterministic checker extracts every entity (skill, tool, company, number, title) from the output and verifies it is permitted: in the inventory, a curated implication of it, or user-attested. Anything else is flagged.
5. **LLM verifier (judge)** — a separate, narrow model call asks, per rewritten bullet: *"Is this claim fully supported by this source text? Quote the support or answer NO."* Catches semantic inflation that token-matching misses (e.g. "led a team" when source says "worked in a team").

A unit only ships to the user if it passes layers 4 and 5. Failures are either auto-stripped, auto-regenerated, or surfaced to the user as a flag — never silently kept.

---

## 3. User flow

1. **Upload resume** (PDF / DOCX) — or paste text.
2. **Provide target job** — paste JD text (job-URL fetch is v2).
3. **Parsing** — Docling + inventory extraction run (≈5–20s).
4. **Inventory review (human gate)** — the user sees exactly what we extracted (skills, roles, bullets, metrics) and:
   - corrects any misreads,
   - optionally **attests** to a real skill the parser missed (explicit confirmation),
   - confirms. *Nothing is generated until this step is done.* This is what stops a parser miss from later being flagged as fabrication.
5. **Optimising** — generation + validation pipeline runs (≈10–40s). Progress shown.
6. **Review screen** — the core of the product:
   - **Side-by-side diff**: original vs. re-positioned, changes highlighted.
   - Each change is **accept/reject** at the bullet level; user may also **edit text directly**.
   - **Match score** against the JD (how much of the JD's requirements the candidate genuinely covers).
   - **Honest Gaps panel** (see §6) — requirements the JD wants that the resume shows *no evidence* for. Shown as advice, **never injected into the resume.**
   - **Split integrity badge** — AI changes (repositioned / reworded / surfaced / implied — *0 fabricated*) shown separately from user changes (attested / edited).
7. **Choose template** — a short gallery of ATS-safe templates; smart-default to the one closest to the uploaded resume's style.
8. **Export** — ATS-clean DOCX and PDF in the chosen template.

---

## 4. System architecture

The pipeline runs in **two phases with a human gate between them**: Phase A parses and extracts the inventory, then *stops* for user confirmation; Phase B optimises, validates, and renders. This maps cleanly onto a serverless queue (each phase is a short, HTTP-triggered job).

```
┌──────────────┐     ┌─────────────────────────────────────────┐
│  Next.js web │────▶│  NestJS API (REST, on Vercel)            │
│  (Vercel)    │◀────│  session / inventory / job / export ctrl │
└──────────────┘ SSE └───────────────┬──────────────────────────┘
                                      │ enqueue (HTTP)
                                      ▼
                         ┌────────────────────────┐
                         │ Upstash QStash         │  ← serverless queue
                         │ (delivers jobs to API) │     (replaces BullMQ)
                         └───────┬────────────────┘
              Phase A ◀──────────┘        └──────────▶ Phase B
       (parse → inventory, then STOP   (JD model → match → reposition
        for user review)                → validate → verify → render)
                 │                                   │
   ┌─────────────┼──────────────┐        ┌───────────┼───────────┐
   ▼             ▼              ▼         ▼           ▼           ▼
┌────────┐ ┌──────────────┐ ┌────────┐ ┌────────┐ ┌────────────┐
│Supabase│ │ Docling Serve│ │Supabase│ │ Gemini │ │ Supabase   │
│Postgres│ │ (container   │ │Storage │ │  API   │ │ Storage    │
│ + Auth │ │  host, NOT   │ │(files) │ │(free)  │ │ (outputs)  │
└────────┘ │  Vercel)     │ └────────┘ └────────┘ └────────────┘
           └──────────────┘
```

### Hosting topology (decided)

| Component | Host | Notes |
|---|---|---|
| Frontend (Next.js) | **Vercel** | as specified |
| Backend API + pipeline stages (NestJS) | **Vercel** (serverless) | request/response + short HTTP-triggered stage handlers |
| Queue | **Upstash QStash** | **swaps out BullMQ** — Vercel has no always-on process to run a BullMQ worker. QStash delivers jobs to API endpoints over HTTP. Sits behind the `repositioner-core` queue interface, so BullMQ-on-a-container remains a drop-in alternative if you ever want it. |
| Docling Serve | **Fly.io or Railway** (container) | **cannot run on Vercel** — long-running Python service loading ML models, far over serverless size/shape limits. Use scale-to-zero to stay near-free while idle. |
| Postgres + Storage + Auth | **Supabase** | as specified |
| LLM | **Google AI Studio (Gemini API)** | free tier; behind a swappable engine interface (§9). No billing account attached → can't incur charges. |

> **Why not BullMQ on Vercel:** BullMQ needs a persistent worker polling Redis; Vercel functions are short-lived with no always-on process. QStash is the serverless-native equivalent and the human-gate pause is trivial (just don't enqueue Phase B until the user confirms). If you'd rather keep BullMQ as originally specced, move the NestJS backend to a container host (Railway/Render) and let Vercel host only the frontend — the core package's queue interface makes this swap clean.
>
> **Stage duration:** each phase must finish inside Vercel's function limit (≈300s on Pro). Phase B is several LLM calls (~20–60s) — fine; if it ever approaches the cap, split render into its own job.

---

## 5. The processing pipeline (the heart)

Each stage is a discrete, independently testable step. State is persisted between stages so any stage can be re-run.

### Stage 1 — Document parse (Docling Serve sidecar)
Extract structured content from PDF/DOCX/images. This stage is owned by **Docling** (IBM Research, MIT-licensed) running as a separate containerized service — *not* an in-process Node library.

**Why Docling:** it resolves the messy-resume cases the cheap parsers mangle — multi-column layouts, "skills sidebar" resumes, reading order, and table structure — and handles **OCR for scanned/image resumes in the same call** (collapsing the old tesseract fallback into one tool). Output is a unified `DoclingDocument` (Markdown + lossless JSON with sections, reading order, and tables already resolved), which feeds Stage 2 far more reliably than flat text. Parsing also stays **local to our infrastructure** — the file never leaves our environment at this step (see §11).

**Architecture — sidecar, not in-process.** Docling is Python; our backend is NestJS. So we run **Docling Serve** as its own container exposing a REST endpoint, and Stage 1's worker calls it over HTTP. Only this one stage touches Python; everything else stays Node. Because parsing is the CPU/ML-heavy step, running it as a separate service lets us **scale it independently** of the web API instead of loading ML models into every API pod.

```
Pipeline worker (Node) ──HTTP POST (file bytes)──▶ Docling Serve (Python container)
                       ◀── DoclingDocument JSON/MD ──┘
```

- **Interface:** Stage 1 sits behind the `repositioner-core` parse interface (§15). The worker uploads the file to Docling Serve and receives `DoclingDocument` JSON; nothing downstream knows or cares that Docling produced it.
- **MVP shortcut:** for the very first cut you may stub this interface with lightweight Node parsers (`mammoth` for DOCX, `pdf-parse` for text PDFs) and swap in the Docling sidecar behind the same interface once you hit resumes the cheap parsers break on — no rewrite required.
- **Ops notes:** ship Docling Serve as a pinned Docker image; pre-warm/keep-alive to avoid cold-start model-load latency; set request size limits and timeouts; health-check before enqueueing. GPU optional (CPU works; the Heron layout model keeps CPU parsing usable).
- **Output:** `DoclingDocument` (sections, reading order, tables, OCR text) → handed to Stage 2.

> **Future (tseboIQ):** Docling also ships an MCP server. We deliberately use **Docling Serve (HTTP)** here because Stage 1 is a deterministic, every-run step, not an agent decision. Reserve **Docling MCP** for a later tseboIQ assistant that decides on its own initiative to parse arbitrary uploads.

### Stage 2 — Candidate Inventory extraction (source of truth)
LLM call (Gemini Flash) parses the text into a strict schema. Every item gets a stable `id`. **This artifact becomes immutable once the user confirms it (Stage 2.5)** — until then it is editable.

```jsonc
{
  "contact": { "name": "...", "email": "...", "phone": "...", "links": ["..."] },
  "summary_raw": "original summary text, verbatim",
  "experiences": [
    {
      "id": "exp_01",
      "company": "Digital Solution Foundry",
      "title": "Software Engineer",
      "start": "2023-02", "end": "2025-11",
      "bullets": [
        { "id": "b_01", "text": "verbatim original bullet",
          "entities": { "skills": ["React","TypeScript"], "tools": ["Docker"],
                        "metrics": ["reduced load time by 30%"], "actions": ["built","optimised"] } }
      ]
    }
  ],
  "skills": [ { "id": "sk_01", "name": "TypeScript", "proficiency_stated": "advanced|none" } ],
  "projects": [ { "id": "pr_01", "name": "...", "bullets": [...] } ],
  "education": [...],
  "certifications": [ { "id": "cert_01", "name": "AZ-104", "status": "completed" } ]
}
```

The `entities` extraction here is what powers validation later. Extract **conservatively** — if proficiency isn't stated, `proficiency_stated: "none"` (so the validator blocks any upgrade). Attach a `confidence` to each item so the review screen can highlight uncertain extractions.

### Stage 2.5 — Inventory review & confirmation (HUMAN GATE)
**The pipeline stops here until the user confirms.** This is the fix for the inventory's single-point-of-failure: a machine-derived source of truth that nothing checks will eventually mis-extract, and Stage 6 would then strip the candidate's *real* skill as "fabrication." So the user sees what we found and:
- **Edits/corrects** any field (fix a mis-parsed title, merge duplicate skills, drop a hallucinated one).
- **Attests** to a real skill the parser missed — added with `origin: "attested"` (the user explicitly vouches; the validator will then allow it, but it stays tagged as user-asserted, not machine-derived).
- **Confirms** → inventory is frozen (`confirmed: true`) and Phase B is enqueued.

Each inventory item carries an `origin`: `extracted` | `attested` | `edited`. This tag flows all the way to the integrity badge so AI-trustable facts and user-vouched facts never blur. No `confirmed` inventory → no generation.

### Stage 3 — Job Requirements model
LLM parses the JD into structured requirements.

```jsonc
{
  "title": "Senior JavaScript Engineer",
  "seniority": "senior",
  "must_have": ["JavaScript","React","Node.js","REST APIs","CI/CD"],
  "nice_to_have": ["TypeScript","AWS","GraphQL"],
  "responsibilities": ["lead feature delivery","mentor juniors","system design"],
  "ats_keywords": ["JavaScript","React","Agile","unit testing", ...],
  "soft_signals": ["fast-paced","ownership","cross-functional"]
}
```

### Stage 4 — Match & gap analysis (deterministic + LLM-assisted)
For each JD requirement, find supporting evidence in the **confirmed** inventory, and classify into three buckets — the distinction that makes "highlight what they already have" work:
- **Covered (listed)** — already in the Skills section. Keep, reorder up.
- **Latent (evidence exists, not surfaced)** — appears in a bullet/project but not the Skills section, *or* follows from a curated implication (Express ⇒ Node.js). → **promote/surface it** (this is the core value).
- **Gap (no evidence anywhere)** — → **Honest Gaps panel only. Never injected into the resume.**

Mechanics:
- Exact + fuzzy + synonym-map + implication-map matching first (deterministic, cheap, auditable).
- LLM only for ambiguous semantic matches ("built data pipelines" ↔ "ETL experience").
- Output per requirement: `covered | latent | gap`, with supporting `source_id`(s) and the rule that matched (synonym/implication/semantic).
- **Match score** = weighted coverage of `must_have` + `nice_to_have`, counting covered + latent (not gaps).

### Stage 5 — Re-positioning generation (constrained)
The core generation call. Input = inventory + JD model + match map. The model produces a *re-positioned resume plan*: reordered sections, reworded bullets, a targeted summary.

Hard requirement on the output schema: **every emitted bullet and skill carries `source_id` + `change_type`.**

```jsonc
{
  "summary": { "text": "...", "source_ids": ["exp_01","sk_01","pr_01"], "change_type": "resummarised" },
  "experiences_order": ["exp_01","exp_03","exp_02"],
  "bullets": [
    { "source_id": "b_01", "original": "...", "rewritten": "...",
      "change_type": "reworded", "rationale": "surfaces REST API work the JD requires" }
  ],
  "skills_order": ["sk_01","sk_04","sk_02"],
  "dropped": ["b_09"]   // irrelevant, demoted/removed — allowed
}
```

System prompt rules (abbreviated): only reorder/reword/re-summarise; every output unit must trace to a `source_id`; never introduce a skill/number/title absent from the inventory; never raise stated proficiency; if you cannot improve a bullet honestly, return it unchanged.

### Stage 6 — Programmatic validation (deterministic gate)
For each rewritten unit, extract entities and assert each is permitted. An entity is permitted iff it is one of:
- **In the inventory** (exact, or via the synonym allowlist).
- **A curated implication** of an inventory fact — the antecedent is present *and* the `(antecedent ⇒ skill)` rule exists in the audited **implication allowlist** (Express⇒Node.js, etc.). Implications are conservative and near-certain only; this is *not* free inference.
- **User-attested** (`origin: "attested"` in the confirmed inventory).

Anything else is a violation:
- **Numbers/metrics**: every numeric token in the rewrite must appear in the cited source text. *No exceptions.* This kills invented metrics.
- **Proficiency words** ("expert", "lead", "architected"): blocked unless the source supports them.
- Result per unit: `pass | fail(reason)`. Fails → Stage 7 (or auto-strip the offending clause).

This stage is plain TypeScript, fully unit-testable, and produces an audit trail. It's your integrity guarantee in code, not vibes. The implication and synonym allowlists are versioned data, so every "allow" decision is traceable to a specific rule.

### Stage 7 — LLM verifier / judge (semantic gate)
A separate, cheap, narrow call per flagged-or-reworded unit:

> "SOURCE: «original bullet». REWRITE: «new bullet». Is every claim in REWRITE fully supported by SOURCE? Reply JSON: `{ "supported": true|false, "support_quote": "...", "violation": "..." }`."

- `supported: false` → regenerate once with the violation fed back, else revert to original.
- Keep this model call deliberately dumb and single-purpose; judges are more reliable when the question is binary and scoped.

### Stage 8 — Render (template gallery)
Assemble accepted units into an **ATS-safe** document in the user's chosen template.
- **Template gallery (short, MVP ~3):** e.g. *Classic* (single-column, the safest ATS default), *Modern* (single-column with an accent colour/heading style), *Compact* (denser single-column). Two-column styles are flagged ATS-risky and gated behind a warning, not offered as the default.
- **Approximate the original look, don't reproduce it.** We do *not* pixel-replicate the uploaded PDF (brittle, frequently ATS-hostile). Instead: detect coarse style signals from Docling (accent colour, serif vs sans, density) and **smart-default to the closest template**, which the user can override.
- All templates render from the *same* content model, so switching templates never changes a single claim — only presentation.
- DOCX via `docx`; PDF from the same source (LibreOffice headless convert, or render-to-PDF) so both formats match.
- Store outputs; return download URLs.

---

## 6. Anti-fabrication, restated as guarantees

| Risk | Mechanism |
|---|---|
| Invented skill/tool | Stage 6: permitted only if in inventory, a curated implication, or user-attested |
| Invented metric/number | Stage 6 numeric-token check vs cited source text |
| Proficiency inflation | `proficiency_stated` recorded in Stage 2; Stage 6 blocks upgrades |
| Semantic inflation ("worked on" → "led") | Stage 7 LLM judge |
| Over-eager implication (AWS ⇒ "DevOps") | Implication allowlist is conservative + audited; only near-certain `(antecedent ⇒ skill)` rules |
| Parser miss strips a real skill | Stage 2.5 human review + attestation before generation |
| JD keyword stuffing of skills not held | Stage 4 *gaps* quarantined to the Honest Gaps panel (latent ≠ gap) |
| Terminology drift mistaken for new claims | Controlled synonym allowlist (curated, versioned) |

**Split integrity badge.** Because the user can now attest and edit, the badge separates the two trust domains so neither is overstated:
- *AI changes:* `repositioned · reworded · surfaced (latent) · implied (Node.js←Express) — 0 fabricated`
- *Your changes:* `attested skills · manual edits` (labelled "your responsibility")

**Honest Gaps panel** turns the constraint into a *feature*: instead of lying to cover a gap, the product tells the candidate the truth — "This role wants Kubernetes; your resume shows Docker but not K8s. Either add it honestly if you have it, or be ready to address it." That's career advice users will pay for and trust.

---

## 7. Data model (Prisma sketch)

```prisma
model User {
  id         String     @id @default(cuid())
  email      String     @unique
  sessions   Session[]
  createdAt  DateTime   @default(now())
}

model Session {
  id               String   @id @default(cuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id])
  status           Status   @default(UPLOADED)
  // UPLOADED → PARSING → INVENTORY_REVIEW → (user confirms) → OPTIMISING → READY → FAILED
  resumeFileKey    String
  inventory        Json?    // Candidate Inventory; items carry origin: extracted|attested|edited + confidence
  inventoryConfirmed Boolean @default(false)  // gate for Phase B
  jobModel         Json?    // Job Requirements model
  matchReport      Json?    // covered | latent | gap, with matched rule
  repositionPlan   Json?    // Stage 5 output
  integrityReport  Json?    // pass/fail audit per unit, split AI vs user
  templateId       String?  // chosen output template
  outputDocxKey    String?
  outputPdfKey     String?
  expiresAt        DateTime // POPIA retention (see §11)
  createdAt        DateTime @default(now())
}

model SynonymRule {     // controlled terminology allowlist (React.js ⇄ React)
  id        String   @id @default(cuid())
  canonical String           // "JavaScript"
  aliases   String[]         // ["JS","ECMAScript"]
}

model ImplicationRule { // curated, conservative "antecedent ⇒ implied skill"
  id         String  @id @default(cuid())
  antecedent String          // "Express"  (must appear in inventory)
  implies    String          // "Node.js"
  note       String?         // rationale, for auditability
}
```

> No billing entities in the MVP: this is a **private pilot** (you + a few invited users). Monetization is deferred to the tseboIQ integration (§15).

---

## 8. API design (REST, NestJS)

```
POST  /sessions                      # create, upload resume (multipart)
POST  /sessions/:id/job              # attach JD text
POST  /sessions/:id/parse            # enqueue Phase A (Docling + inventory)
GET   /sessions/:id                  # status + reports (poll) — or SSE /sessions/:id/stream
GET   /sessions/:id/inventory        # the extracted inventory for review
PATCH /sessions/:id/inventory        # edit / attest items (origin tracked)
POST  /sessions/:id/inventory/confirm# freeze inventory, enqueue Phase B
PATCH /sessions/:id/decisions        # accept/reject/edit per-unit changes
GET   /sessions/:id/templates        # available output templates + smart default
POST  /sessions/:id/export           # { templateId, format: "docx" | "pdf" }
GET   /sessions/:id/download/:format
DELETE /sessions/:id                 # user-initiated wipe (POPIA)

# internal (QStash-triggered)
POST  /internal/phase-a/:id          # parse → inventory → INVENTORY_REVIEW
POST  /internal/phase-b/:id          # JD model → match → reposition → validate → verify → render
```

---

## 9. LLM integration

**Engine: Google AI Studio (Gemini API), free tier.** Chosen because the pilot must cost nothing — the free tier ships ~1,500 requests/day on Flash with no card and no expiry, which is far more than pilot volume needs.

- **Swappable behind a `Rephraser`/`LlmEngine` interface.** All model use sits behind one interface in `repositioner-core` (e.g. `extract()`, `rephrase()`, `judge()`). The engine is config: `gemini` for the pilot; `ollama` (local, fully private) or `anthropic` (paid, highest quality) are drop-in swaps later with no pipeline changes. This is a one-line change, not a rewrite.
- **SDK:** Google's `@google/genai` (Node) or the OpenAI-compatible endpoint Gemini exposes (lets you keep an OpenAI-shaped client and swap base URLs per engine).
- **Model:** **Gemini Flash** (e.g. `gemini-2.5-flash` / `flash-lite`) for *every* call — extraction, JD parse, rewrite, judge. All are cheap, narrow tasks; you do **not** need Gemini Pro (its free quota is tiny — ~50 req/day — and you don't need it). Confirm the current model id + free limits in AI Studio at build time; Google changes these and they vary by region.
- **Structured output:** instruct strict JSON, no prose/markdown fences; parse + validate against a Zod schema; reject + retry on parse failure. (Gemini also supports a response-schema/JSON mode — use it.)
- **Cost-guard (important):** create the API key on a Google Cloud project with **no billing account attached**, so exceeding the free quota *fails the request* (→ fall back to verbatim) instead of silently charging. Never wire a card to the pilot project.
- Always set output token limits sized to the schema; low temperature for extraction/validation, moderate only for the rewrite call.
- **Mandatory PII redaction (hosted-engine rule):** because the free tier may train on prompts, redact name/email/phone/employer from any text before it leaves for Gemini, and re-attach identity locally at render (§11). This rule is enforced in the `gemini` engine adapter; the `ollama` engine (local) may skip it since nothing leaves the box.
- **Not the LLM's job:** synonym and implication allowlists are *curated data*, never produced by the model at runtime. The model may *use* them, but expanding them is a deliberate, reviewed change (see §14 cold-start).

---

## 10. Frontend (the review UI)

- **Inventory-review screen** (the new human gate): show extracted skills/roles/bullets grouped, with low-`confidence` items visually flagged; inline edit; an "add a skill I actually have" attestation control; a clear **Confirm** to release Phase B.
- **Diff view** is the product. Bullet-level diff (not raw text diff) keyed on `source_id`, with `change_type` colour coding (reworded / reordered / surfaced / dropped). Per-change **accept/reject**, plus free text edit.
- **Split integrity badge** + **match score** prominent — this is the trust surface.
- **Honest Gaps** as a separate, clearly non-resume advisory panel.
- **Template picker** before export; live preview; smart-default highlighted.
- **Auth:** Supabase Auth, invite-only for the pilot (email magic link).
- Mobile-friendly review (a lot of job seekers are phone-first, very relevant in the SA market).

---

## 11. Privacy, security, POPIA

Resumes are personal information under POPIA — treat accordingly.
- **Consent** at upload; clear purpose statement (process to re-position, nothing else).
- **Retention**: auto-delete source + outputs after a short TTL (e.g. 7–30 days, `expiresAt`); user can wipe immediately.
- **Encryption** at rest (storage) and in transit (TLS).
- **Local parsing**: Stage 1 runs on the self-hosted Docling service, so the resume *file* never leaves our infrastructure — only extracted text is sent onward at Stage 2.
- **Mandatory PII redaction before the LLM**: the LLM engine is the Gemini free tier, whose terms permit training on prompts. So name/email/phone/employer are stripped before any text is sent to Gemini and re-attached locally at render. Enforced in the engine adapter (§9). Switching the engine to local Ollama removes this exposure entirely.
- **Sub-processor disclosure**: de-identified resume text is sent to Google's Gemini API — disclose this in the privacy policy, including that the free tier may use prompts for training; confirm current terms before onboarding real users.
- **Minimise**: don't store more than needed; consider redacting contact details before the LLM calls (re-attach locally at render).
- **Access controls** + audit logging on session data.

---

## 12. Cost & profitability

**Pilot phase: no monetization, and the LLM is free.** This runs privately for you plus a few invited users, so there's no billing to build now — and the Gemini free tier (§9) covers all LLM calls at R0 within its daily quota, which pilot volume won't approach. Remaining costs are just the idle-cheap Docling container (scale-to-zero) + Supabase free/low tier + QStash free tier. The one thing to watch is the Docling container's always-warm vs scale-to-zero tradeoff (cold start vs idle cost).

**Monetization comes with tseboIQ** (§15), where the optimised-resume feature lives inside the profile screen. Models to revisit then — all noted now so the data layer can absorb them later without a rewrite:
- **Freemium**: 1 free tailoring, then credits / subscription.
- **Pay-per-tailoring** credit packs (low friction, good for SA price sensitivity; Paystack / PayFast / Yoco for local rails).
- **Subscription** for active job seekers.

Margin lever (matters once you're on a paid engine inside tseboIQ): **cache the confirmed inventory** so re-tailoring the *same* resume to a *new* job skips Phase A entirely — most users target many jobs with one resume, so this avoids re-running extraction on every application.

---

## 13. Scope: pilot → wider pilot → tseboIQ

**Pilot MVP (ship this — for you + invited users):**
- DOCX/PDF upload + paste JD.
- Full pipeline with all integrity layers (non-negotiable — it's the product).
- **Inventory review gate** with edit + attestation.
- Diff review with accept/reject + direct edit.
- **Template gallery** (~3) with smart default; DOCX + PDF export.
- Honest Gaps panel + split integrity badge.
- Supabase Auth (invite-only). POPIA basics. **No billing.**

**Wider pilot:**
- A handful of external users; tighten extraction/validation against real-world resumes; grow the synonym + implication allowlists from observed cases.

**tseboIQ integration (public):**
- Docling/inventory reused to **pre-populate profile form fields** from an uploaded resume.
- Optimised-resume feature built into the **profile screen**; user uploads the JD there.
- Monetization (§12), application tracker, cover-letter generation under the same no-fabrication rules.
- Job-URL scraping, LinkedIn/recruiter-view optimisation, multi-language — all later.

> MVP language: **English only.**

---

## 14. Risks & open questions

- **Synonym + implication allowlist cold-start**: empty lists make Stage 6 hostile on day one (flags "React.js" vs "React", blocks legit Express⇒Node). **Seed both** before first run — a starter tech-skills synonym set, and a small hand-written implication list — then grow from real pilot cases. Treat list expansion as reviewed changes, not LLM output.
- **Implication scope creep**: the line is "near-certain technical implication only." Express⇒Node.js, yes. AWS⇒"DevOps", no. Keep a rationale `note` on every rule and review additions.
- **Render fidelity vs. preserve-look**: we *approximate* the original via the closest template, not pixel-reproduce it (§5 Stage 8). Set this expectation in the UI so users aren't surprised.
- **Two-phase / human-gate UX**: a session can sit in `INVENTORY_REVIEW` indefinitely. Handle abandonment (TTL cleanup), resumability, and clear "your turn" prompts.
- **Parsing messy resumes**: largely handled by Docling; residual risk is heavily graphic/templated resumes — keep a "we couldn't read this cleanly, paste text?" fallback.
- **Judge cost/latency** at scale: only judge reworded/flagged units, not untouched ones.
- **Rephrasing vs inflation rubric**: still worth writing explicitly + a tricky-case test set to validate Stage 6/7 against.

**Resolved:**
- Standalone pilot first → tseboIQ later (§15). ✓
- Inventory is **user-reviewed and confirmed** before generation; users may **attest** missing-but-real skills and **edit** output directly (origin-tracked, shown separately). ✓
- Output = **template gallery**, smart-default to closest to original. ✓
- Hosting: Vercel (front + API) + QStash (queue) + Docling on a container host + Supabase. ✓

---

## 15. Designing the standalone for a clean tseboIQ merge

The app ships standalone, but build it so the later merge is *configuration, not a rewrite*. Three rules:

- **Treat the pipeline as a library, not the app.** Stages 1–8 live in a framework-agnostic package (`packages/repositioner-core`) that takes inputs and returns reports/outputs. The standalone's NestJS controllers are a thin layer over it; tseboIQ later calls the same package. No business logic in controllers.
- **Auth behind an interface.** Define a `CurrentUser` / `getUserId()` boundary the standalone fills with its own auth, and tseboIQ later fills with its existing identity. Don't let auth assumptions leak into pipeline or data code.
- **Portable, self-contained data.** Keep `Session` and its JSON reports independent of any tseboIQ schema. When you merge, you migrate sessions by re-pointing `userId`, nothing more. Avoid foreign keys into tables that won't exist yet.

What stays standalone-only and gets dropped/replaced at merge: the standalone's auth (→ tseboIQ identity) and the marketing/landing surface. What carries over unchanged: the `repositioner-core` package, the integrity test set, and the synonym + implication allowlists. Treat the **integrity test set as the asset that proves readiness to merge** — don't fold into tseboIQ until it's green and stable in production.

**How it lands inside tseboIQ:**
- **Profile pre-fill:** the same Docling parse + Stage 2 inventory powers auto-population of profile form fields from an uploaded resume — Phase A is reused wholesale, just with a different consumer of the inventory.
- **Optimised resume in the profile screen:** the output feature lives on the profile; the user uploads a JD there to trigger Phase B. Inventory is already on file from pre-fill, so most runs skip straight to optimisation (the caching win from §12).
- This is also where monetization and the application tracker attach.

---

## 16. Suggested build order

1. **Phase A**: Docling Serve (container) + Stage 2 inventory extraction + Zod schemas + a test resume set. *Get extraction trustworthy first.*
2. **Inventory-review gate** (Stage 2.5) + edit/attest UI. *The human checkpoint everything downstream trusts.*
3. **Seed the synonym + implication allowlists**, then build the **Stage 6 validator** in isolation with unit tests for fabricated skills/metrics/proficiency *and* the allow-paths (synonym, implication, attested). *Prove the guarantee before generation sits on top of it.*
4. Stages 3–4 (JD model + match, with latent-vs-gap classification).
5. Stage 5 generation, gated by 6 + 7.
6. Render (Stage 8) with the template gallery.
7. Review UI + diff + split integrity badge.
8. Wire the QStash two-phase flow, Supabase Auth (invite-only), POPIA retention, export.
