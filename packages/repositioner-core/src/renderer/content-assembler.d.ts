import { CandidateInventory, Contact, Education, Certification } from '../schemas/inventory.schema';
import { RepositionPlan } from '../schemas/reposition-plan.schema';
export interface UserDecisions {
    [sourceId: string]: {
        action: 'accept' | 'reject' | 'edit';
        editedText?: string;
    };
}
export interface AssembledBullet {
    text: string;
    changed: boolean;
}
export interface AssembledExperience {
    id: string;
    company: string;
    title: string;
    startDate: string;
    endDate: string;
    bullets: AssembledBullet[];
}
export interface AssembledSkill {
    name: string;
    proficiency?: string | undefined;
}
export interface AssembledProject {
    name: string;
    description?: string;
    bullets: AssembledBullet[];
}
export interface AssembledResume {
    contact: Contact;
    summary?: string;
    experiences: AssembledExperience[];
    skills: AssembledSkill[];
    projects: AssembledProject[];
    education: Education[];
    certifications: Certification[];
}
export declare function assembleResume(inventory: CandidateInventory, plan: RepositionPlan, decisions?: UserDecisions): AssembledResume;
export declare function formatDate(dateStr: string): string;
