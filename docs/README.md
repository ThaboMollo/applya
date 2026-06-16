# Implementation Plans

This directory contains the detailed implementation plan for each build phase of the Resume Re-Positioner (FitCV), derived from [resume-repositioner-spec.md](../resume-repositioner-spec.md) §16.

The phases are ordered by dependency — each phase builds on the one before it.

| # | File | Spec Stages | Summary |
|---|---|---|---|
| 1 | [01-document-parsing-and-extraction.md](./01-document-parsing-and-extraction.md) | Stage 1 + 2 | Docling Serve sidecar, Candidate Inventory extraction, Zod schemas |
| 2 | [02-inventory-review-gate.md](./02-inventory-review-gate.md) | Stage 2.5 | Human gate UI: edit, attest, confirm the inventory |
| 3 | [03-validation-engine-and-allowlists.md](./03-validation-engine-and-allowlists.md) | Stage 6 | Seed synonym/implication data, build the deterministic validator |
| 4 | [04-jd-analysis-and-matching.md](./04-jd-analysis-and-matching.md) | Stage 3 + 4 | JD requirements model, match & gap analysis, match score |
| 5 | [05-generation-and-verification.md](./05-generation-and-verification.md) | Stage 5 + 7 | Re-positioning generation, LLM judge, retry/revert logic |
| 6 | [06-template-rendering.md](./06-template-rendering.md) | Stage 8 | ATS-safe template gallery, DOCX/PDF rendering |
| 7 | [07-review-ui-and-diff.md](./07-review-ui-and-diff.md) | §10 (Frontend) | Diff view, accept/reject, integrity badge, Honest Gaps panel |
| 8 | [08-infrastructure-wiring.md](./08-infrastructure-wiring.md) | §4, §8, §9, §11 | QStash flow, Supabase Auth, POPIA retention, LLM engine, export |
