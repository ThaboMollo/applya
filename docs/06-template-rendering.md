# Phase 6 — Template Rendering & Document Export

**Spec references:** §5 Stage 8, §3 (user flow steps 7–8)
**Depends on:** Phase 5 (a validated `RepositionPlan`).
**Produces:** ATS-safe DOCX and PDF files, stored in Supabase Storage with download URLs.

---

## 1. What this phase delivers

Stage 8 of the pipeline: taking the validated reposition plan and rendering it into a polished, ATS-safe document in the user's chosen template. The output is a DOCX file (primary) and a PDF file (secondary), both generated from the same content model so switching templates never changes a single claim.

---

## 2. Template gallery

### 2.1 MVP templates (3)

| Template | Description | ATS Safety | Default for |
|----------|-------------|-----------|------------|
| **Classic** | Single-column, clean serif or sans-serif headings, minimal styling. Traditional resume look. | ✅ Safest | Multi-column/complex uploaded resumes (safe fallback) |
| **Modern** | Single-column with a subtle accent colour on headings, slightly bolder typography. | ✅ Safe | Resumes with accent colours or modern styling |
| **Compact** | Single-column, denser layout with smaller margins and tighter spacing. Fits more on one page. | ✅ Safe | Long resumes (3+ pages) |

All templates are **single-column** for ATS safety. Two-column layouts are explicitly deferred — if added later, they must carry an ATS-risk warning.

### 2.2 Template definition structure

Each template is a configuration object, not a separate code path. All templates render from the same content model.

```typescript
// packages/repositioner-core/src/templates/template.types.ts

export interface TemplateConfig {
  id: string;                          // "classic" | "modern" | "compact"
  name: string;                        // display name
  description: string;
  fonts: {
    heading: string;                   // e.g., "Calibri", "Georgia"
    body: string;
  };
  fontSizes: {
    name: number;                      // in half-points (docx convention)
    sectionHeading: number;
    jobTitle: number;
    body: number;
  };
  margins: {
    top: number;                       // in twips
    bottom: number;
    left: number;
    right: number;
  };
  accentColor?: string;                // hex, e.g., "#2563EB" (Modern only)
  spacing: {
    afterParagraph: number;
    betweenSections: number;
    bulletIndent: number;
  };
}
```

### 2.3 Smart-default selection

Detect coarse style signals from the Docling parse result and pick the closest template:

```typescript
// packages/repositioner-core/src/templates/template-selector.ts

export function selectDefaultTemplate(
  parseMetadata: ParseResult["metadata"],
  inventory: CandidateInventory,
): string {
  // Rule 1: If the resume is 3+ pages (many bullets), suggest Compact
  const bulletCount = inventory.experiences.reduce((sum, e) => sum + e.bullets.length, 0);
  if (bulletCount > 20) return "compact";

  // Rule 2: If Docling detected multi-column layout, default to Classic (safe fallback)
  if (parseMetadata.detectedLayout === "multi-column") return "classic";

  // Rule 3: Default to Modern (the most visually appealing safe option)
  return "modern";
}
```

---

## 3. DOCX rendering

### 3.1 Library: `docx` (npm)

The `docx` package generates `.docx` files programmatically with full control over formatting. It does not require Word or LibreOffice installed.

### 3.2 Content model → DOCX mapping

The renderer takes the `RepositionPlan` + confirmed `CandidateInventory` + user decisions (accept/reject per unit) and produces the final document.

```typescript
// packages/repositioner-core/src/stages/stage8-render.ts

export async function renderDocx(
  inventory: CandidateInventory,
  plan: RepositionPlan,
  decisions: UserDecisions,          // which changes were accepted/rejected
  template: TemplateConfig,
): Promise<Buffer> {
  const doc = new Document({
    styles: buildStyles(template),
    sections: [{
      properties: {
        page: {
          margin: template.margins,
        },
      },
      children: [
        // 1. Contact header (name, email, phone, links)
        ...renderContactHeader(inventory.contact, template),

        // 2. Professional summary
        ...renderSummary(plan.summary, decisions, template),

        // 3. Skills section (reordered, with surfaced skills added)
        ...renderSkillsSection(inventory.skills, plan, decisions, template),

        // 4. Experience section (reordered, with accepted/rejected bullet changes)
        ...renderExperienceSection(inventory.experiences, plan, decisions, template),

        // 5. Projects section (if any)
        ...renderProjectsSection(inventory.projects, plan, decisions, template),

        // 6. Education section
        ...renderEducationSection(inventory.education, template),

        // 7. Certifications section (if any)
        ...renderCertificationsSection(inventory.certifications, template),
      ],
    }],
  });

  return Packer.toBuffer(doc);
}
```

### 3.3 Applying user decisions

The user can accept or reject individual changes from the reposition plan. The renderer must respect these decisions:

```typescript
function renderBullet(
  bullet: RepositionedBullet,
  decision: "accept" | "reject" | "edit",
  editedText?: string,
): Paragraph {
  let text: string;
  if (decision === "accept") {
    text = bullet.rewritten;        // use the AI's version
  } else if (decision === "reject") {
    text = bullet.original;         // keep the original
  } else {
    text = editedText!;             // use the user's edit
  }
  // Return a Paragraph with the appropriate text and formatting
}
```

### 3.4 ATS safety rules

Applied across all templates:
- **No text boxes, tables-as-layout, or floating elements.** ATS parsers choke on these.
- **No images or icons.** Skill-level bars, profile photos, etc. are stripped.
- **Standard heading hierarchy.** Section titles use Heading styles the ATS can parse.
- **Standard bullet characters.** Use `•` or `-`, not custom symbols.
- **No header/footer content that matters.** Some ATS parsers skip headers/footers. Contact info goes in the body.

---

## 4. PDF rendering

### 4.1 Strategy: DOCX-first, then convert

Generate the DOCX first (it's the primary format and the one the user edits). Then convert to PDF so both formats are visually identical.

### 4.2 Conversion options

| Option | Pros | Cons |
|--------|------|------|
| **LibreOffice headless** (`libreoffice --headless --convert-to pdf`) | High fidelity, widely used | Requires LibreOffice installed on the server (heavy for serverless) |
| **Puppeteer/Playwright** (render HTML to PDF) | Works in serverless | Requires a separate HTML render path (divergence risk) |
| **`docx-pdf` or similar** | Lightweight | Low fidelity, limited formatting support |

**Recommended for MVP:** Use LibreOffice headless running on the Docling container (it's already a container host). Send the DOCX buffer to an endpoint on the container that runs the conversion and returns the PDF buffer. This keeps the Vercel serverless functions lightweight.

If LibreOffice is too heavy, defer PDF to v2 and ship DOCX-only for the pilot.

---

## 5. File storage & download

### 5.1 Supabase Storage

```typescript
// Upload the generated files
const docxKey = `sessions/${sessionId}/output.docx`;
const pdfKey  = `sessions/${sessionId}/output.pdf`;

await supabase.storage.from("outputs").upload(docxKey, docxBuffer, {
  contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
});
await supabase.storage.from("outputs").upload(pdfKey, pdfBuffer, {
  contentType: "application/pdf",
});

// Update the session with file keys
await prisma.session.update({
  where: { id: sessionId },
  data: { outputDocxKey: docxKey, outputPdfKey: pdfKey, status: "READY" },
});
```

### 5.2 Download endpoint

```
GET /sessions/:id/download/:format    # format = "docx" | "pdf"
```

Returns a short-lived signed URL from Supabase Storage (e.g., 1 hour expiry). The frontend opens this URL in a new tab to trigger the download.

---

## 6. API endpoints (this phase)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/sessions/:id/templates` | Returns available templates with the smart-default highlighted |
| `POST` | `/sessions/:id/export` | `{ templateId, format }` — triggers rendering and stores output |
| `GET` | `/sessions/:id/download/:format` | Returns signed download URL |

---

## 7. Verification checklist

- [ ] DOCX generation produces a valid `.docx` file that opens in Word/Google Docs without errors.
- [ ] All three templates (Classic, Modern, Compact) render correctly.
- [ ] Switching templates changes only presentation, never content.
- [ ] Accepted changes use the rewritten text; rejected changes use the original text.
- [ ] User-edited text is used when the decision is "edit".
- [ ] Contact info, skills, experiences, projects, education, and certs all render in the correct order.
- [ ] Surfaced skills appear in the skills section.
- [ ] Dropped bullets are excluded.
- [ ] Generated files are stored in Supabase Storage and the session is updated with file keys.
- [ ] Download endpoint returns a working signed URL.
- [ ] PDF matches the DOCX layout (if PDF is implemented in this phase).
