"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDocx = renderDocx;
const docx_1 = require("docx");
const TEMPLATES = {
    classic: { accentColor: '000000', nameSize: 36, headingSize: 22, bodySize: 20, sectionSpacingBefore: 200, sectionSpacingAfter: 60 },
    modern: { accentColor: '2563EB', nameSize: 40, headingSize: 22, bodySize: 20, sectionSpacingBefore: 200, sectionSpacingAfter: 60 },
    compact: { accentColor: '000000', nameSize: 32, headingSize: 20, bodySize: 18, sectionSpacingBefore: 120, sectionSpacingAfter: 40 },
};
async function renderDocx(resume, templateId = 'classic') {
    const cfg = TEMPLATES[templateId] ?? TEMPLATES.classic;
    const children = [];
    children.push(new docx_1.Paragraph({
        alignment: docx_1.AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [new docx_1.TextRun({
                text: resume.contact.name,
                bold: true,
                size: cfg.nameSize,
                color: cfg.accentColor,
            })],
    }));
    const contactParts = [
        resume.contact.email,
        resume.contact.phone,
        ...resume.contact.links,
    ].filter(Boolean);
    if (contactParts.length > 0) {
        children.push(new docx_1.Paragraph({
            alignment: docx_1.AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [new docx_1.TextRun({ text: contactParts.join('  |  '), size: cfg.bodySize, color: '444444' })],
        }));
    }
    if (resume.summary) {
        children.push(sectionHeading('PROFESSIONAL SUMMARY', cfg));
        children.push(bodyParagraph(resume.summary, cfg));
    }
    if (resume.experiences.length > 0) {
        children.push(sectionHeading('EXPERIENCE', cfg));
        for (const exp of resume.experiences) {
            children.push(new docx_1.Paragraph({
                tabStops: [{ type: docx_1.TabStopType.RIGHT, position: 9360, leader: docx_1.LeaderType.NONE }],
                spacing: { before: 100, after: 0 },
                children: [
                    new docx_1.TextRun({ text: exp.company, bold: true, size: cfg.bodySize }),
                    new docx_1.TextRun({ text: `\t${exp.startDate} – ${exp.endDate}`, size: cfg.bodySize, color: '444444' }),
                ],
            }));
            children.push(new docx_1.Paragraph({
                spacing: { before: 0, after: 40 },
                children: [new docx_1.TextRun({ text: exp.title, italics: true, size: cfg.bodySize })],
            }));
            for (const bullet of exp.bullets) {
                children.push(bulletParagraph(bullet.text, cfg));
            }
        }
    }
    if (resume.skills.length > 0) {
        children.push(sectionHeading('SKILLS', cfg));
        children.push(bodyParagraph(resume.skills.map((s) => s.name).join('  ·  '), cfg));
    }
    if (resume.projects.length > 0) {
        children.push(sectionHeading('PROJECTS', cfg));
        for (const proj of resume.projects) {
            children.push(new docx_1.Paragraph({
                spacing: { before: 100, after: 20 },
                children: [new docx_1.TextRun({ text: proj.name, bold: true, size: cfg.bodySize })],
            }));
            if (proj.description) {
                children.push(bodyParagraph(proj.description, cfg));
            }
            for (const bullet of proj.bullets) {
                children.push(bulletParagraph(bullet.text, cfg));
            }
        }
    }
    if (resume.education.length > 0) {
        children.push(sectionHeading('EDUCATION', cfg));
        for (const edu of resume.education) {
            const dateRange = [edu.start, edu.end].filter(Boolean).join(' – ');
            children.push(new docx_1.Paragraph({
                tabStops: [{ type: docx_1.TabStopType.RIGHT, position: 9360, leader: docx_1.LeaderType.NONE }],
                spacing: { before: 80, after: 0 },
                children: [
                    new docx_1.TextRun({ text: edu.institution, bold: true, size: cfg.bodySize }),
                    ...(dateRange ? [new docx_1.TextRun({ text: `\t${dateRange}`, size: cfg.bodySize, color: '444444' })] : []),
                ],
            }));
            const degreeText = [edu.degree, edu.field].filter(Boolean).join(', ');
            children.push(new docx_1.Paragraph({
                spacing: { before: 0, after: 60 },
                children: [new docx_1.TextRun({ text: degreeText, italics: true, size: cfg.bodySize })],
            }));
        }
    }
    if (resume.certifications.length > 0) {
        children.push(sectionHeading('CERTIFICATIONS', cfg));
        for (const cert of resume.certifications) {
            children.push(new docx_1.Paragraph({
                spacing: { before: 60, after: 20 },
                children: [
                    new docx_1.TextRun({ text: cert.name, bold: true, size: cfg.bodySize }),
                    ...(cert.issuer ? [new docx_1.TextRun({ text: ` — ${cert.issuer}`, size: cfg.bodySize, color: '444444' })] : []),
                    ...(cert.date ? [new docx_1.TextRun({ text: `  (${cert.date})`, size: cfg.bodySize, color: '666666' })] : []),
                ],
            }));
        }
    }
    const doc = new docx_1.Document({
        sections: [{
                properties: {
                    page: { margin: { top: 720, right: 1080, bottom: 720, left: 1080 } },
                },
                children,
            }],
    });
    return docx_1.Packer.toBuffer(doc);
}
function sectionHeading(text, cfg) {
    return new docx_1.Paragraph({
        spacing: { before: cfg.sectionSpacingBefore, after: cfg.sectionSpacingAfter },
        border: {
            bottom: { color: cfg.accentColor, space: 1, style: docx_1.BorderStyle.SINGLE, size: 6 },
        },
        children: [
            new docx_1.TextRun({
                text,
                bold: true,
                size: cfg.headingSize,
                color: cfg.accentColor,
                underline: cfg.accentColor !== '000000' ? { type: docx_1.UnderlineType.NONE } : undefined,
            }),
        ],
    });
}
function bodyParagraph(text, cfg) {
    return new docx_1.Paragraph({
        spacing: { before: 0, after: 60 },
        children: [new docx_1.TextRun({ text, size: cfg.bodySize })],
    });
}
function bulletParagraph(text, cfg) {
    return new docx_1.Paragraph({
        indent: { left: 360 },
        spacing: { before: 0, after: 40 },
        children: [new docx_1.TextRun({ text: `• ${text}`, size: cfg.bodySize })],
    });
}
//# sourceMappingURL=docx.renderer.js.map