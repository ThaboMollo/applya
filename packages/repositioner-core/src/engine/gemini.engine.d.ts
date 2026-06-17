import { LlmEngine } from '../interfaces/llm-engine.interface';
import { CandidateInventory } from '../schemas/inventory.schema';
import { JobModel } from '../schemas/job-model.schema';
import { RepositionPlan } from '../schemas/reposition-plan.schema';
export declare class GeminiEngine implements LlmEngine {
    private readonly apiKey;
    private readonly ai;
    constructor(apiKey: string);
    extractInventory(docText: string): Promise<CandidateInventory>;
    parseJobModel(jobDescription: string): Promise<JobModel>;
    semanticMatch(requirement: string, evidence: string): Promise<boolean>;
    repositionResume(inventory: CandidateInventory, jobModel: JobModel, matchContext: string): Promise<RepositionPlan>;
    verifyUnit(source: string, rewrite: string): Promise<{
        supported: boolean;
        support_quote?: string;
        violation?: string;
    }>;
    private generateJson;
}
export declare function redactPii(text: string, candidateName?: string): string;
