import { CandidateInventory } from '../schemas/inventory.schema';
import { RepositionPlan } from '../schemas/reposition-plan.schema';
import { UserDecisions } from './content-assembler';
import { TemplateId } from './docx.renderer';
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
export declare const TEMPLATE_GALLERY: {
    id: TemplateId;
    name: string;
    description: string;
    atsRisk: string;
}[];
export declare class Renderer {
    render(input: RenderInput): Promise<RenderOutput>;
}
