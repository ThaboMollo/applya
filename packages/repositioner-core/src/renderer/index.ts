import { CandidateInventory } from '../schemas/inventory.schema';
import { RepositionPlan } from '../schemas/reposition-plan.schema';
import { assembleResume, UserDecisions } from './content-assembler';
import { renderDocx, TemplateId } from './docx.renderer';
import { renderPdf } from './pdf.renderer';

export type { UserDecisions, AssembledResume } from './content-assembler';
export type { TemplateId } from './docx.renderer';

export interface RenderInput {
  inventory: CandidateInventory;
  plan: RepositionPlan;
  decisions?: UserDecisions;
  templateId?: TemplateId;
}

export interface RenderOutput {
  docxBuffer: Buffer;
  pdfBuffer: Buffer;
}

export const TEMPLATE_GALLERY = [
  { id: 'classic' as TemplateId, name: 'Classic', description: 'Single-column, ATS-safest default', atsRisk: 'low' },
  { id: 'modern'  as TemplateId, name: 'Modern',  description: 'Single-column with accent colour headings', atsRisk: 'low' },
  { id: 'compact' as TemplateId, name: 'Compact', description: 'Denser single-column for longer CVs', atsRisk: 'low' },
];

/**
 * Stage 8 — Renderer.
 * Assembles final resume content from the accepted plan + user decisions,
 * then renders to DOCX and PDF in the chosen template.
 *
 * Contact data (PII) is re-attached here from the original inventory —
 * it was stripped before any LLM calls (§9, §11).
 */
export class Renderer {
  async render(input: RenderInput): Promise<RenderOutput> {
    const { inventory, plan, decisions = {}, templateId = 'classic' } = input;

    const assembled = assembleResume(inventory, plan, decisions);
    const [docxBuffer, pdfBuffer] = await Promise.all([
      renderDocx(assembled, templateId),
      renderPdf(assembled, templateId),
    ]);

    return { docxBuffer, pdfBuffer };
  }
}
