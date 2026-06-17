import {
  Document,
  Paragraph,
  TextRun,
  Packer,
  AlignmentType,
  BorderStyle,
  UnderlineType,
  TabStopType,
  LeaderType,
} from 'docx';
import { AssembledResume } from './content-assembler';

export type TemplateId = 'classic' | 'modern' | 'compact';

interface TemplateConfig {
  accentColor: string; // hex without #
  nameSize: number;    // half-points
  headingSize: number;
  bodySize: number;
  sectionSpacingBefore: number; // twips
  sectionSpacingAfter: number;
}

const TEMPLATES: Record<TemplateId, TemplateConfig> = {
  classic: { accentColor: '000000', nameSize: 36, headingSize: 22, bodySize: 20, sectionSpacingBefore: 200, sectionSpacingAfter: 60 },
  modern:  { accentColor: '2563EB', nameSize: 40, headingSize: 22, bodySize: 20, sectionSpacingBefore: 200, sectionSpacingAfter: 60 },
  compact: { accentColor: '000000', nameSize: 32, headingSize: 20, bodySize: 18, sectionSpacingBefore: 120, sectionSpacingAfter: 40 },
};

export async function renderDocx(resume: AssembledResume, templateId: TemplateId = 'classic'): Promise<Buffer> {
  const cfg = TEMPLATES[templateId] ?? TEMPLATES.classic;
  const children: Paragraph[] = [];

  // ── Name ──────────────────────────────────────────────────────────────────
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({
      text: resume.contact.name,
      bold: true,
      size: cfg.nameSize,
      color: cfg.accentColor,
    })],
  }));

  // ── Contact line ──────────────────────────────────────────────────────────
  const contactParts = [
    resume.contact.email,
    resume.contact.phone,
    ...resume.contact.links,
  ].filter(Boolean) as string[];

  if (contactParts.length > 0) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: contactParts.join('  |  '), size: cfg.bodySize, color: '444444' })],
    }));
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  if (resume.summary) {
    children.push(sectionHeading('PROFESSIONAL SUMMARY', cfg));
    children.push(bodyParagraph(resume.summary, cfg));
  }

  // ── Experience ────────────────────────────────────────────────────────────
  if (resume.experiences.length > 0) {
    children.push(sectionHeading('EXPERIENCE', cfg));
    for (const exp of resume.experiences) {
      // Company — right-aligned date (tab stop)
      children.push(new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: 9360, leader: LeaderType.NONE }],
        spacing: { before: 100, after: 0 },
        children: [
          new TextRun({ text: exp.company, bold: true, size: cfg.bodySize }),
          new TextRun({ text: `\t${exp.startDate} – ${exp.endDate}`, size: cfg.bodySize, color: '444444' }),
        ],
      }));
      // Title
      children.push(new Paragraph({
        spacing: { before: 0, after: 40 },
        children: [new TextRun({ text: exp.title, italics: true, size: cfg.bodySize })],
      }));
      // Bullets
      for (const bullet of exp.bullets) {
        children.push(bulletParagraph(bullet.text, cfg));
      }
    }
  }

  // ── Skills ────────────────────────────────────────────────────────────────
  if (resume.skills.length > 0) {
    children.push(sectionHeading('SKILLS', cfg));
    children.push(bodyParagraph(resume.skills.map((s) => s.name).join('  ·  '), cfg));
  }

  // ── Projects ──────────────────────────────────────────────────────────────
  if (resume.projects.length > 0) {
    children.push(sectionHeading('PROJECTS', cfg));
    for (const proj of resume.projects) {
      children.push(new Paragraph({
        spacing: { before: 100, after: 20 },
        children: [new TextRun({ text: proj.name, bold: true, size: cfg.bodySize })],
      }));
      if (proj.description) {
        children.push(bodyParagraph(proj.description, cfg));
      }
      for (const bullet of proj.bullets) {
        children.push(bulletParagraph(bullet.text, cfg));
      }
    }
  }

  // ── Education ─────────────────────────────────────────────────────────────
  if (resume.education.length > 0) {
    children.push(sectionHeading('EDUCATION', cfg));
    for (const edu of resume.education) {
      const dateRange = [edu.start, edu.end].filter(Boolean).join(' – ');
      children.push(new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: 9360, leader: LeaderType.NONE }],
        spacing: { before: 80, after: 0 },
        children: [
          new TextRun({ text: edu.institution, bold: true, size: cfg.bodySize }),
          ...(dateRange ? [new TextRun({ text: `\t${dateRange}`, size: cfg.bodySize, color: '444444' })] : []),
        ],
      }));
      const degreeText = [edu.degree, edu.field].filter(Boolean).join(', ');
      children.push(new Paragraph({
        spacing: { before: 0, after: 60 },
        children: [new TextRun({ text: degreeText, italics: true, size: cfg.bodySize })],
      }));
    }
  }

  // ── Certifications ────────────────────────────────────────────────────────
  if (resume.certifications.length > 0) {
    children.push(sectionHeading('CERTIFICATIONS', cfg));
    for (const cert of resume.certifications) {
      children.push(new Paragraph({
        spacing: { before: 60, after: 20 },
        children: [
          new TextRun({ text: cert.name, bold: true, size: cfg.bodySize }),
          ...(cert.issuer ? [new TextRun({ text: ` — ${cert.issuer}`, size: cfg.bodySize, color: '444444' })] : []),
          ...(cert.date ? [new TextRun({ text: `  (${cert.date})`, size: cfg.bodySize, color: '666666' })] : []),
        ],
      }));
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: { margin: { top: 720, right: 1080, bottom: 720, left: 1080 } },
      },
      children,
    }],
  });

  return Packer.toBuffer(doc);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sectionHeading(text: string, cfg: TemplateConfig): Paragraph {
  return new Paragraph({
    spacing: { before: cfg.sectionSpacingBefore, after: cfg.sectionSpacingAfter },
    border: {
      bottom: { color: cfg.accentColor, space: 1, style: BorderStyle.SINGLE, size: 6 },
    },
    children: [
      new TextRun({
        text,
        bold: true,
        size: cfg.headingSize,
        color: cfg.accentColor,
        underline: cfg.accentColor !== '000000' ? { type: UnderlineType.NONE } : undefined,
      }),
    ],
  });
}

function bodyParagraph(text: string, cfg: TemplateConfig): Paragraph {
  return new Paragraph({
    spacing: { before: 0, after: 60 },
    children: [new TextRun({ text, size: cfg.bodySize })],
  });
}

function bulletParagraph(text: string, cfg: TemplateConfig): Paragraph {
  return new Paragraph({
    indent: { left: 360 },
    spacing: { before: 0, after: 40 },
    children: [new TextRun({ text: `• ${text}`, size: cfg.bodySize })],
  });
}
