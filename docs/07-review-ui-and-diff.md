# Phase 7 — Review UI & Diff View

**Spec references:** §3 (user flow step 6), §6 (integrity badge, Honest Gaps), §10 (frontend)
**Depends on:** Phase 5 (reposition plan + integrity report), Phase 6 (template rendering).
**Produces:** The core product screen — the side-by-side diff view with accept/reject, integrity badge, Honest Gaps panel, and template picker.

---

## 1. What this phase delivers

This is the main product screen. After Phase B runs, the user lands here to review every change the system made, accept or reject each one, make manual edits, see their match score, understand their honest gaps, pick a template, and export.

---

## 2. Screen layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back to Sessions           Resume Review           Match: 78%   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─ Integrity Badge ──────────────────────────────────────────────┐ │
│  │ AI: 4 reworded · 2 surfaced · 1 implied (Node.js←Express)     │ │
│  │     0 fabricated                                                │ │
│  │ You: 1 attested skill · 2 manual edits                         │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─ Professional Summary ─────────────────────────────────────────┐ │
│  │  ORIGINAL:                      │  REPOSITIONED:               │ │
│  │  "Passionate software           │  "Software engineer with     │ │
│  │   engineer with 3 years..."     │   3 years of React and       │ │
│  │                                 │   Node.js experience..."     │ │
│  │                            [Accept] [Reject] [Edit]            │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─ Experience: Software Engineer @ DSF ──────────────────────────┐ │
│  │                                                                 │ │
│  │  Bullet 1:   ■ reworded                                        │ │
│  │  ORIGINAL: "Built React components for dashboard"              │ │
│  │  CHANGED:  "Developed React and TypeScript components for a    │ │
│  │            customer-facing dashboard, reducing load time by 30%"│ │
│  │  WHY: "Surfaces TypeScript and the 30% metric the JD values"  │ │
│  │                            [Accept ✓] [Reject] [Edit]          │ │
│  │                                                                 │ │
│  │  Bullet 2:   ■ unchanged                                       │ │
│  │  "Maintained CI/CD pipelines using GitHub Actions"             │ │
│  │  (no changes — already well-positioned)                        │ │
│  │                                                                 │ │
│  │  Bullet 3:   ■ surfaced                                        │ │
│  │  ORIGINAL: "Containerised microservices using Docker"          │ │
│  │  CHANGED:  "Containerised microservices with Docker, enabling  │ │
│  │            reproducible deployments across environments"       │ │
│  │  + Docker added to Skills section                              │ │
│  │                            [Accept] [Reject ✗] [Edit]          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─ Skills ───────────────────────────────────────────────────────┐ │
│  │  New order: React · TypeScript · Node.js(implied) · Docker     │ │
│  │             (surfaced) · REST APIs · Git                       │ │
│  │  + Node.js (implied from Express)     [Accept] [Reject]       │ │
│  │  + Docker (surfaced from bullet 3)    [Accept] [Reject]       │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─ Honest Gaps ──────────────────────────────────────────────────┐ │
│  │  These requirements appear in the JD but not in your resume:   │ │
│  │                                                                 │ │
│  │  ⚠ Kubernetes — The JD asks for Kubernetes experience.        │ │
│  │    Your resume shows Docker but not K8s. If you have this      │ │
│  │    experience, add it honestly. Otherwise, be ready to         │ │
│  │    address this in the interview.                              │ │
│  │                                                                 │ │
│  │  ⚠ GraphQL — Listed as nice-to-have. Not found in your       │ │
│  │    resume.                                                     │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─ Template & Export ────────────────────────────────────────────┐ │
│  │  [ Classic ]   [★ Modern ]   [ Compact ]                      │ │
│  │                                                                 │ │
│  │  [Preview]   [ Download DOCX ↓ ]   [ Download PDF ↓ ]         │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component breakdown

### 3.1 Integrity Badge

```typescript
interface IntegrityBadgeProps {
  report: IntegrityReport;
}
```

Displays two rows:
- **AI changes:** `{reworded} reworded · {surfaced} surfaced · {implied.length} implied — 0 fabricated`
- **Your changes:** `{attested_skills.length} attested skills · {edited_items} manual edits`

The "0 fabricated" is always present and always 0 — it's the trust statement. Colour it green.

### 3.2 Diff view (per bullet)

Each bullet is a card showing:
- A **change_type badge** with colour coding:
  - `unchanged` → grey
  - `reworded` → blue
  - `reordered` → purple
  - `surfaced` → green
  - `dropped` → red (strikethrough)
- **Original text** (left or top on mobile).
- **Changed text** (right or bottom on mobile), with inline word-level diff highlighting.
- **Rationale** — the AI's explanation of why it made this change (collapsed by default, expandable).
- **Action buttons:** Accept (default to accepted for non-controversial changes), Reject, Edit.

For `unchanged` bullets, show them in a collapsed/muted state so the screen focuses on actual changes.

### 3.3 Accept/Reject/Edit controls

```typescript
interface BulletDecision {
  bulletId: string;             // source_id
  decision: "accept" | "reject" | "edit";
  editedText?: string;          // only if decision === "edit"
}
```

**State management:**
- Decisions are stored locally (React state) as the user interacts.
- A "Save decisions" action sends them to `PATCH /sessions/:id/decisions`.
- The export endpoint reads decisions from the session to determine which text to use.

**Default state:**
- `reworded` / `surfaced` bullets default to "accept" (the system's changes are usually good).
- `dropped` bullets default to "accept" (the system decided they're irrelevant).
- The user can override any default.

### 3.4 Inline edit modal

When the user clicks "Edit" on a bullet:
- Show a text area pre-filled with the rewritten text (or original if rejected).
- User edits freely.
- On save: the decision becomes `"edit"` with the new text.
- Edited text is tagged `origin: "edited"` in the integrity report and displayed under "Your changes" in the badge.

### 3.5 Match score

A prominent number (e.g., `78%`) with a colour indicator:
- ≥ 80%: green (strong match)
- 60–79%: amber (decent match)
- < 60%: red (weak match, many gaps)

Tooltip or expandable breakdown: "X/Y must-haves covered, Z/W nice-to-haves covered."

### 3.6 Honest Gaps panel

Shows `gap` items from the match report. For each gap:
- The requirement name.
- Whether it's `must_have` or `nice_to_have`.
- Advisory text: "Your resume shows no evidence for this. If you have this experience, add it honestly. Otherwise, be prepared to discuss this in the interview."
- An optional "I actually have this" button that takes the user back to the inventory to attest the skill (if the session isn't yet exported — stretch goal).

### 3.7 Template picker

A row of template cards showing:
- Template name and brief description.
- The smart-default is highlighted with a star or "Recommended" badge.
- Clicking a template updates the selection (stored on the session).
- Optional: live preview in a modal (render a small preview image of the first page).

### 3.8 Export buttons

- "Download DOCX" and "Download PDF" buttons.
- On click: call `POST /sessions/:id/export` with the selected template and format.
- Show a loading spinner while rendering.
- On completion, trigger the download via the signed URL from `GET /sessions/:id/download/:format`.

---

## 4. API endpoint (this phase)

| Method | Path | Purpose |
|--------|------|---------|
| `PATCH` | `/sessions/:id/decisions` | Save accept/reject/edit decisions per bullet |

---

## 5. Mobile responsiveness

The review screen must work well on a 375px viewport:
- Diff view switches from side-by-side to stacked (original on top, changed below).
- Accept/Reject/Edit buttons are full-width on mobile.
- Honest Gaps collapses into an accordion.
- Template picker uses a horizontal scroll instead of a grid.

---

## 6. Verification checklist

- [ ] The diff view renders all changed bullets with correct change_type colour coding.
- [ ] Unchanged bullets are shown in a collapsed/muted state.
- [ ] Accept/reject/edit controls update local state correctly.
- [ ] Decisions are persisted to the backend via `PATCH /sessions/:id/decisions`.
- [ ] The integrity badge accurately reflects AI changes vs user changes.
- [ ] The Honest Gaps panel shows only `gap` items, never items that are `covered` or `latent`.
- [ ] The match score is displayed with correct colour coding.
- [ ] The template picker highlights the smart-default.
- [ ] Export buttons trigger rendering and download.
- [ ] The screen is usable on a 375px mobile viewport.
