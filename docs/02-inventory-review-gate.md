# Phase 2 — Inventory Review Gate (Human Checkpoint)

**Spec references:** §5 Stage 2.5, §3 (user flow step 4), §10 (frontend)
**Depends on:** Phase 1 (extraction must produce a `CandidateInventory`).
**Produces:** A confirmed, frozen inventory that Phase B trusts as the complete source of truth.

---

## 1. What this phase delivers

The Inventory Review screen — the human gate that the entire anti-fabrication guarantee depends on. The user sees exactly what the system extracted, corrects misreads, attests to missed skills, and confirms. **Nothing downstream runs until this confirmation happens.** This is the most important UX in the product because it determines whether the source of truth is accurate.

---

## 2. API endpoints

### 2.1 `GET /sessions/:id/inventory`

Returns the extracted inventory for display in the review UI.

```typescript
// Response shape
{
  inventory: CandidateInventory;  // the full structured inventory
  confirmed: boolean;             // false until user confirms
  sessionStatus: "INVENTORY_REVIEW";
}
```

### 2.2 `PATCH /sessions/:id/inventory`

Applies edits to the inventory. Supports three operations:

```typescript
// Request body
{
  operations: [
    // Edit an existing item (fix a misparsed title, correct a bullet)
    {
      type: "edit",
      path: "experiences[0].title",    // JSON path to the field
      value: "Senior Software Engineer",
      // Server sets origin → "edited" on the affected item
    },
    // Attest a new skill the parser missed
    {
      type: "attest",
      section: "skills",
      item: {
        name: "Kubernetes",
        proficiency_stated: "intermediate",
        // Server generates id, sets origin → "attested", confidence → 1.0
      },
    },
    // Delete a hallucinated item
    {
      type: "delete",
      path: "skills[3]",
    },
    // Merge duplicate skills
    {
      type: "merge",
      keep: "sk_01",       // the skill to keep
      remove: "sk_04",     // the duplicate to remove
    }
  ]
}
```

**Origin tracking rules:**
- Items the LLM extracted start as `origin: "extracted"`.
- If the user edits any field on an extracted item → `origin: "edited"`.
- If the user adds a new item → `origin: "attested"`, `confidence: 1.0`.
- The `origin` tag is immutable after confirmation. It flows through the entire pipeline to the split integrity badge on the review screen.

**Validation:**
- The session must be in `INVENTORY_REVIEW` status.
- `inventoryConfirmed` must be `false`.
- Reject attempts to edit a confirmed inventory (return 409 Conflict).

### 2.3 `POST /sessions/:id/inventory/confirm`

Freezes the inventory and enqueues Phase B.

```typescript
// Server-side logic:
async confirmInventory(sessionId: string) {
  // 1. Verify session is in INVENTORY_REVIEW status
  // 2. Verify the inventory exists and has at least 1 experience
  // 3. Set inventoryConfirmed = true
  // 4. Set status = OPTIMISING
  // 5. Enqueue Phase B via QStash: POST /internal/phase-b/:id
  // 6. Return { status: "OPTIMISING" }
}
```

**After confirmation, the inventory is immutable.** No further edits are accepted. This is the moment the source of truth is sealed. All downstream stages (generation, validation, judging) reference this frozen snapshot.

---

## 3. Frontend: Inventory Review Screen

This is the critical user-facing screen. It must be clear, trustworthy, and mobile-friendly.

### 3.1 Layout

```
┌─────────────────────────────────────────────────────┐
│  ← Back                    Review Your Resume Data  │
│                                                     │
│  We extracted the following from your resume.       │
│  Please review, correct any errors, and confirm.    │
│                                                     │
│  ┌─ Contact ──────────────────────────────────────┐ │
│  │  Name: Thabo Mponya  [edit]                    │ │
│  │  Email: thabo@example.com  [edit]              │ │
│  │  Phone: +27 ...  [edit]                        │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  ┌─ Skills ───────────────────────────────────────┐ │
│  │  ✓ TypeScript (advanced)     ✓ React           │ │
│  │  ✓ Docker                    ⚠ "Kubernets"     │ │
│  │                          [+ Add a skill I have] │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  ┌─ Experience ───────────────────────────────────┐ │
│  │  ▼ Software Engineer @ Digital Solution Foundry│ │
│  │    Feb 2023 – Nov 2025                         │ │
│  │    • Built React components...         [edit]  │ │
│  │      Skills: React, TypeScript                 │ │
│  │      Metrics: "reduced load time by 30%"       │ │
│  │    • Containerised services with Docker [edit]  │ │
│  │      Skills: Docker   Tools: Docker            │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  ┌─ Projects / Education / Certifications ────────┐ │
│  │  (collapsible sections, same pattern)          │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│         [ Confirm & Continue → ]                    │
│  By confirming, you verify this data is accurate.   │
└─────────────────────────────────────────────────────┘
```

### 3.2 Key UI behaviours

**Low-confidence highlighting:**
- Items with `confidence < 0.7` get a yellow/amber warning indicator (⚠).
- Tooltip or inline message: "We're not sure about this extraction. Please verify."

**Inline editing:**
- Click any text field to edit it in place.
- Edited items are visually marked (e.g., a small "edited" badge) so the user knows what they changed.

**Skill attestation modal:**
- Button: "+ Add a skill I actually have"
- Opens a simple form: skill name, proficiency level (optional, defaults to "none").
- The added skill appears with an "attested" badge — clearly distinct from extracted skills.

**Entity tag display:**
- Under each bullet, show the extracted entities in muted chips/tags: `Skills: React, TypeScript` | `Metrics: "30%"`.
- This gives the user visibility into what the validator will later check against, building trust in the system.

**Confirm button:**
- Disabled until the user has scrolled through all sections (or explicitly dismisses — don't be hostile about it).
- On click: calls `POST /sessions/:id/inventory/confirm`.
- Shows a brief confirmation: "Your data has been locked. Generating your tailored resume…"
- Transitions to a progress/loading screen while Phase B runs.

### 3.3 Mobile responsiveness

The spec notes that many SA job seekers are phone-first. The review screen must:
- Stack sections vertically on narrow screens.
- Use touch-friendly edit controls (no tiny inline icons).
- Ensure the confirm button is always reachable without excessive scrolling.

---

## 4. Implementation details

### 4.1 Inventory diffing for PATCH

The `PATCH` endpoint receives an array of operations. On the server, apply them sequentially to the current inventory JSON. Use a utility function:

```typescript
// packages/repositioner-core/src/utils/inventory-patcher.ts
export function applyOperations(
  inventory: CandidateInventory,
  operations: InventoryOperation[],
): CandidateInventory {
  // Deep-clone the inventory
  // For each operation:
  //   - "edit": set the value at the JSON path, mark origin: "edited"
  //   - "attest": push a new item with generated ID, origin: "attested"
  //   - "delete": remove the item at the path
  //   - "merge": remove the duplicate, keep references intact
  // Re-validate against CandidateInventorySchema
  // Return the patched inventory
}
```

### 4.2 Session state machine

The session's `status` field acts as a state machine. Enforce valid transitions:

```
UPLOADED → PARSING → INVENTORY_REVIEW → OPTIMISING → READY
                                                    ↘ FAILED
```

- `INVENTORY_REVIEW` is the only status where inventory edits are accepted.
- `OPTIMISING` is set the moment the user confirms.
- Any stage failure → `FAILED` with an error message stored on the session.

### 4.3 Abandonment handling

Sessions in `INVENTORY_REVIEW` may sit indefinitely if the user walks away. Handle this with:
- The `expiresAt` TTL already on the session (default 30 days) — stale sessions get cleaned up.
- A "Resume where you left off" banner if the user returns to a session in `INVENTORY_REVIEW`.

---

## 5. Verification checklist

- [ ] The inventory review screen renders all extracted data: contact, skills, experiences, projects, education, certs.
- [ ] Low-confidence items (< 0.7) are visually flagged.
- [ ] Editing a skill name via `PATCH` correctly sets `origin: "edited"`.
- [ ] Attesting a new skill via `PATCH` adds it with `origin: "attested"` and `confidence: 1.0`.
- [ ] Deleting an item removes it from the inventory.
- [ ] Confirming the inventory sets `inventoryConfirmed: true` and transitions status to `OPTIMISING`.
- [ ] After confirmation, `PATCH /inventory` returns 409.
- [ ] Phase B is enqueued via QStash only after confirmation.
- [ ] The UI works on a 375px-wide viewport (mobile).
