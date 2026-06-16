# Applya — Resume Re-Positioner

**Re-position your resume for any job. Honestly.**

Applya takes your existing resume and a target job description, then re-positions your experience to highlight what's relevant — without ever adding a fact that isn't already yours.

Most AI resume tools quietly fabricate: invented metrics, inflated titles, skills you never claimed. Applya is built differently. Every change is traceable to your original resume, verified by a multi-layer integrity pipeline, and transparently shown to you for approval.

---

## What It Does

1. **Upload your resume** (PDF or DOCX) and paste the job description.
2. **Review your data** — see exactly what was extracted from your resume. Correct anything the parser got wrong, or attest to a skill it missed.
3. **Get a tailored resume** — your experiences reordered, bullets rephrased in the job's language, and buried-but-relevant skills surfaced.
4. **See what changed and why** — a side-by-side diff where you accept, reject, or edit every change.
5. **Know your honest gaps** — requirements the job wants that you don't have. Shown as advice, never injected into your resume.
6. **Export** an ATS-friendly DOCX or PDF in your choice of template.

---

## The Integrity Guarantee

Applya may **reorder**, **rephrase**, **re-weight**, and **surface latent skills** — but it will never:

- Add a skill, tool, or certification you don't have
- Invent or alter any number, metric, or date
- Upgrade your stated proficiency ("familiar with" → "expert in")
- Imply experience you didn't claim

This guarantee is enforced structurally across five independent layers, not by prompting alone. A fabrication that slips past one layer is caught by the next.

---

## How It Works

The pipeline runs in **two phases with a human checkpoint between them**:

**Phase A — Parse & Extract**
- Your resume is parsed into a structured Candidate Inventory.
- You review and confirm the extraction before anything else runs.

**Phase B — Optimise & Validate**
- The job description is analysed and matched against your confirmed inventory.
- Your resume is re-positioned, then every generated claim is verified by a deterministic validator and a separate LLM judge.
- Only verified content reaches the review screen.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (Vercel) |
| Backend API | NestJS (Vercel Serverless) |
| Queue | Upstash QStash |
| Document Parsing | Docling Serve (containerised) |
| Database & Auth | Supabase (Postgres, Storage, Auth) |
| LLM | Gemini API (Google AI Studio, free tier) |

Structured as a monorepo: `apps/web`, `apps/api`, and `packages/repositioner-core` — designed for a clean future merge into the broader tseboIQ platform.

---

## Project Status

🚧 **Private pilot** — under active development. Invite-only access.

---

## Documentation

Detailed implementation plans for each build phase are in the [`docs/`](./docs/) directory.

---

## License

[MIT](./LICENSE)