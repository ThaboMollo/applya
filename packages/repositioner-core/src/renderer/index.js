"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Renderer = exports.TEMPLATE_GALLERY = void 0;
const content_assembler_1 = require("./content-assembler");
const docx_renderer_1 = require("./docx.renderer");
const pdf_renderer_1 = require("./pdf.renderer");
exports.TEMPLATE_GALLERY = [
    { id: 'classic', name: 'Classic', description: 'Single-column, ATS-safest default', atsRisk: 'low' },
    { id: 'modern', name: 'Modern', description: 'Single-column with accent colour headings', atsRisk: 'low' },
    { id: 'compact', name: 'Compact', description: 'Denser single-column for longer CVs', atsRisk: 'low' },
];
class Renderer {
    async render(input) {
        const { inventory, plan, decisions = {}, templateId = 'classic' } = input;
        const assembled = (0, content_assembler_1.assembleResume)(inventory, plan, decisions);
        const [docxBuffer, pdfBuffer] = await Promise.all([
            (0, docx_renderer_1.renderDocx)(assembled, templateId),
            (0, pdf_renderer_1.renderPdf)(assembled, templateId),
        ]);
        return { docxBuffer, pdfBuffer };
    }
}
exports.Renderer = Renderer;
//# sourceMappingURL=index.js.map