import PDFDocument = require('pdfkit');
import { AssembledResume } from './content-assembler';
import { TemplateId } from './docx.renderer';

interface PdfTemplateConfig {
  accentHex: string;
  nameSize: number;
  headingSize: number;
  bodySize: number;
  margin: number;
  lineGap: number;
}

const PDF_TEMPLATES: Record<TemplateId, PdfTemplateConfig> = {
  classic: { accentHex: '#000000', nameSize: 18, headingSize: 11, bodySize: 10, margin: 50, lineGap: 2 },
  modern:  { accentHex: '#2563EB', nameSize: 20, headingSize: 11, bodySize: 10, margin: 50, lineGap: 2 },
  compact: { accentHex: '#000000', nameSize: 16, headingSize: 10, bodySize: 9,  margin: 40, lineGap: 1 },
};

export async function renderPdf(resume: AssembledResume, templateId: TemplateId = 'classic'): Promise<Buffer> {
  const cfg = PDF_TEMPLATES[templateId] ?? PDF_TEMPLATES.classic;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: cfg.margin, size: 'A4', bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - cfg.margin * 2;

    // ── Name ──────────────────────────────────────────────────────────────
    doc
      .font('Helvetica-Bold')
      .fontSize(cfg.nameSize)
      .fillColor(cfg.accentHex)
      .text(resume.contact.name, { align: 'center' })
      .moveDown(0.3);

    // ── Contact ───────────────────────────────────────────────────────────
    const contactParts = [resume.contact.email, resume.contact.phone, ...resume.contact.links].filter(Boolean) as string[];
    if (contactParts.length > 0) {
      doc
        .font('Helvetica')
        .fontSize(cfg.bodySize - 1)
        .fillColor('#505050')
        .text(contactParts.join('  |  '), { align: 'center' })
        .moveDown(0.5);
    }

    // ── Summary ───────────────────────────────────────────────────────────
    if (resume.summary) {
      sectionHeader(doc, 'PROFESSIONAL SUMMARY', cfg, pageWidth);
      bodyText(doc, resume.summary, cfg);
    }

    // ── Experience ────────────────────────────────────────────────────────
    if (resume.experiences.length > 0) {
      sectionHeader(doc, 'EXPERIENCE', cfg, pageWidth);
      for (const exp of resume.experiences) {
        const dateRange = `${exp.startDate} – ${exp.endDate}`;
        const y = doc.y;
        doc.font('Helvetica-Bold').fontSize(cfg.bodySize).fillColor('#000000').text(exp.company, cfg.margin, y);
        doc.font('Helvetica').fontSize(cfg.bodySize - 1).fillColor('#505050')
          .text(dateRange, cfg.margin, y, { align: 'right', width: pageWidth });
        doc.moveDown(0.1);
        doc.font('Helvetica-Oblique').fontSize(cfg.bodySize).fillColor('#282828').text(exp.title).moveDown(0.2);
        for (const bullet of exp.bullets) {
          doc.font('Helvetica').fontSize(cfg.bodySize).fillColor('#000000')
            .text(`• ${bullet.text}`, { indent: 10, lineGap: cfg.lineGap });
        }
        doc.moveDown(0.4);
      }
    }

    // ── Skills ────────────────────────────────────────────────────────────
    if (resume.skills.length > 0) {
      sectionHeader(doc, 'SKILLS', cfg, pageWidth);
      doc.font('Helvetica').fontSize(cfg.bodySize).fillColor('#000000')
        .text(resume.skills.map((s) => s.name).join('  ·  '), { lineGap: cfg.lineGap })
        .moveDown(0.4);
    }

    // ── Projects ──────────────────────────────────────────────────────────
    if (resume.projects.length > 0) {
      sectionHeader(doc, 'PROJECTS', cfg, pageWidth);
      for (const proj of resume.projects) {
        doc.font('Helvetica-Bold').fontSize(cfg.bodySize).fillColor('#000000').text(proj.name).moveDown(0.1);
        if (proj.description) {
          doc.font('Helvetica').fontSize(cfg.bodySize).fillColor('#282828').text(proj.description).moveDown(0.1);
        }
        for (const bullet of proj.bullets) {
          doc.font('Helvetica').fontSize(cfg.bodySize).fillColor('#000000')
            .text(`• ${bullet.text}`, { indent: 10, lineGap: cfg.lineGap });
        }
        doc.moveDown(0.4);
      }
    }

    // ── Education ─────────────────────────────────────────────────────────
    if (resume.education.length > 0) {
      sectionHeader(doc, 'EDUCATION', cfg, pageWidth);
      for (const edu of resume.education) {
        const dateRange = [edu.start, edu.end].filter(Boolean).join(' – ');
        const y = doc.y;
        doc.font('Helvetica-Bold').fontSize(cfg.bodySize).fillColor('#000000').text(edu.institution, cfg.margin, y);
        if (dateRange) {
          doc.font('Helvetica').fontSize(cfg.bodySize - 1).fillColor('#505050')
            .text(dateRange, cfg.margin, y, { align: 'right', width: pageWidth });
        }
        doc.moveDown(0.1);
        const degreeText = [edu.degree, edu.field].filter(Boolean).join(', ');
        doc.font('Helvetica-Oblique').fontSize(cfg.bodySize).fillColor('#282828').text(degreeText).moveDown(0.4);
      }
    }

    // ── Certifications ────────────────────────────────────────────────────
    if (resume.certifications.length > 0) {
      sectionHeader(doc, 'CERTIFICATIONS', cfg, pageWidth);
      for (const cert of resume.certifications) {
        const parts = [cert.name, cert.issuer ? `— ${cert.issuer}` : undefined, cert.date ? `(${cert.date})` : undefined].filter(Boolean).join('  ');
        doc.font('Helvetica').fontSize(cfg.bodySize).fillColor('#000000').text(parts).moveDown(0.2);
      }
    }

    doc.end();
  });
}

function sectionHeader(doc: PDFKit.PDFDocument, text: string, cfg: PdfTemplateConfig, width: number) {
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(cfg.headingSize).fillColor(cfg.accentHex).text(text);
  doc.moveTo(cfg.margin, doc.y)
    .lineTo(cfg.margin + width, doc.y)
    .strokeColor(cfg.accentHex)
    .lineWidth(0.5)
    .stroke();
  doc.moveDown(0.3);
}

function bodyText(doc: PDFKit.PDFDocument, text: string, cfg: PdfTemplateConfig) {
  doc.font('Helvetica').fontSize(cfg.bodySize).fillColor('#000000').text(text, { lineGap: cfg.lineGap }).moveDown(0.3);
}
