import { AssembledResume } from './content-assembler';
export type TemplateId = 'classic' | 'modern' | 'compact';
export declare function renderDocx(resume: AssembledResume, templateId?: TemplateId): Promise<Buffer>;
