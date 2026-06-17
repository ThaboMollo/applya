"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assembleResume = assembleResume;
exports.formatDate = formatDate;
function assembleResume(inventory, plan, decisions = {}) {
    const planBulletBySourceId = new Map(plan.bullets.map((b) => [b.source_id, b]));
    const droppedSet = new Set(plan.dropped);
    function resolveBulletText(bulletId, originalText) {
        if (droppedSet.has(bulletId))
            return null;
        const planBullet = planBulletBySourceId.get(bulletId);
        const decision = decisions[bulletId];
        if (!planBullet || planBullet.change_type === 'unchanged') {
            return { text: originalText, changed: false };
        }
        if (decision?.action === 'reject')
            return { text: originalText, changed: false };
        if (decision?.action === 'edit' && decision.editedText)
            return { text: decision.editedText, changed: true };
        return { text: planBullet.rewritten, changed: true };
    }
    const expOrder = plan.experiences_order.length > 0
        ? plan.experiences_order
        : inventory.experiences.map((e) => e.id);
    const experiences = expOrder
        .map((expId) => {
        const exp = inventory.experiences.find((e) => e.id === expId);
        if (!exp)
            return null;
        const bullets = exp.bullets
            .map((b) => resolveBulletText(b.id, b.text))
            .filter((b) => b !== null);
        return {
            id: exp.id,
            company: exp.company,
            title: exp.title,
            startDate: formatDate(exp.start),
            endDate: formatDate(exp.end),
            bullets,
        };
    })
        .filter((e) => e !== null);
    const skillOrder = plan.skills_order.length > 0 ? plan.skills_order : inventory.skills.map((s) => s.id);
    const orderedSkills = skillOrder
        .flatMap((id) => {
        const s = inventory.skills.find((sk) => sk.id === id);
        if (!s)
            return [];
        return [{ name: s.name, proficiency: s.proficiency_stated !== 'none' ? s.proficiency_stated : undefined }];
    });
    const existingSkillNames = new Set(orderedSkills.map((s) => s.name.toLowerCase()));
    for (const surfaced of plan.surfaced_skills) {
        if (!existingSkillNames.has(surfaced.skill_name.toLowerCase())) {
            orderedSkills.push({ name: surfaced.skill_name });
            existingSkillNames.add(surfaced.skill_name.toLowerCase());
        }
    }
    const projects = inventory.projects.map((proj) => ({
        name: proj.name,
        description: proj.description,
        bullets: proj.bullets
            .map((b) => resolveBulletText(b.id, b.text))
            .filter((b) => b !== null),
    }));
    let summary = plan.summary.text;
    const summaryDecision = decisions['summary'];
    if (summaryDecision?.action === 'reject')
        summary = inventory.summary_raw;
    else if (summaryDecision?.action === 'edit' && summaryDecision.editedText)
        summary = summaryDecision.editedText;
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
function formatDate(dateStr) {
    if (!dateStr || /^present$/i.test(dateStr))
        return 'Present';
    const parts = dateStr.split('-');
    const year = parts[0];
    const month = parts[1];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = month ? monthNames[parseInt(month, 10) - 1] : undefined;
    return monthName ? `${monthName} ${year}` : year;
}
//# sourceMappingURL=content-assembler.js.map