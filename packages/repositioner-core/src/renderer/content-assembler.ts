import { CandidateInventory, Contact, Education, Certification } from '../schemas/inventory.schema';
import { RepositionPlan } from '../schemas/reposition-plan.schema';

export interface UserDecisions {
  [sourceId: string]: { action: 'accept' | 'reject' | 'edit'; editedText?: string };
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

export function assembleResume(
  inventory: CandidateInventory,
  plan: RepositionPlan,
  decisions: UserDecisions = {},
): AssembledResume {
  // Index the plan bullets by source_id for fast lookup
  const planBulletBySourceId = new Map(plan.bullets.map((b) => [b.source_id, b]));
  const droppedSet = new Set(plan.dropped);

  function resolveBulletText(bulletId: string, originalText: string): AssembledBullet | null {
    if (droppedSet.has(bulletId)) return null;

    const planBullet = planBulletBySourceId.get(bulletId);
    const decision = decisions[bulletId];

    if (!planBullet || planBullet.change_type === 'unchanged') {
      return { text: originalText, changed: false };
    }

    if (decision?.action === 'reject') return { text: originalText, changed: false };
    if (decision?.action === 'edit' && decision.editedText) return { text: decision.editedText, changed: true };
    // Default: accept the rewrite
    return { text: planBullet.rewritten, changed: true };
  }

  // Assemble experiences in plan order (fall back to inventory order)
  const expOrder = plan.experiences_order.length > 0
    ? plan.experiences_order
    : inventory.experiences.map((e) => e.id);

  const experiences: AssembledExperience[] = expOrder
    .map((expId) => {
      const exp = inventory.experiences.find((e) => e.id === expId);
      if (!exp) return null;

      const bullets = exp.bullets
        .map((b) => resolveBulletText(b.id, b.text))
        .filter((b): b is AssembledBullet => b !== null);

      return {
        id: exp.id,
        company: exp.company,
        title: exp.title,
        startDate: formatDate(exp.start),
        endDate: formatDate(exp.end),
        bullets,
      };
    })
    .filter((e): e is AssembledExperience => e !== null);

  // Assemble skills in plan order + surfaced skills
  const skillOrder = plan.skills_order.length > 0 ? plan.skills_order : inventory.skills.map((s) => s.id);
  const orderedSkills: AssembledSkill[] = skillOrder
    .flatMap((id) => {
      const s = inventory.skills.find((sk) => sk.id === id);
      if (!s) return [];
      return [{ name: s.name, proficiency: s.proficiency_stated !== 'none' ? (s.proficiency_stated as string) : undefined }];
    });

  // Add surfaced skills (latent or implied) not already in the list
  const existingSkillNames = new Set(orderedSkills.map((s) => s.name.toLowerCase()));
  for (const surfaced of plan.surfaced_skills) {
    if (!existingSkillNames.has(surfaced.skill_name.toLowerCase())) {
      orderedSkills.push({ name: surfaced.skill_name });
      existingSkillNames.add(surfaced.skill_name.toLowerCase());
    }
  }

  // Assemble projects (not repositioned in Phase B MVP — use inventory as-is)
  const projects: AssembledProject[] = inventory.projects.map((proj) => ({
    name: proj.name,
    description: proj.description,
    bullets: proj.bullets
      .map((b) => resolveBulletText(b.id, b.text))
      .filter((b): b is AssembledBullet => b !== null),
  }));

  // Summary — use plan summary (accepted or original fallback)
  let summary: string | undefined = plan.summary.text;
  const summaryDecision = decisions['summary'];
  if (summaryDecision?.action === 'reject') summary = inventory.summary_raw;
  else if (summaryDecision?.action === 'edit' && summaryDecision.editedText) summary = summaryDecision.editedText;

  return {
    contact: inventory.contact,
    summary,
    experiences,
    skills: orderedSkills,
    projects,
    education: inventory.education,
    certifications: inventory.certifications,
  };
}

export function formatDate(dateStr: string): string {
  if (!dateStr || /^present$/i.test(dateStr)) return 'Present';
  const parts = dateStr.split('-');
  const year = parts[0];
  const month = parts[1];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = month ? monthNames[parseInt(month, 10) - 1] : undefined;
  return monthName ? `${monthName} ${year}` : year;
}
