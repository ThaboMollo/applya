import { Validator } from './index';
import { CandidateInventory } from '../schemas/inventory.schema';
import { RepositionPlan } from '../schemas/reposition-plan.schema';

// ─────────────────────────────────────────────────────────────────
// Shared test fixture — a confirmed inventory with:
//   - React (extracted skill)
//   - Express (extracted skill, implies Node.js via curated rule)
//   - TypeScript (user-attested skill)
//   - A bullet mentioning Docker (latent — in bullet entities but not Skills section)
// ─────────────────────────────────────────────────────────────────
const BASE_INVENTORY: CandidateInventory = {
  contact: { name: 'Test Candidate', links: [] },
  summary_raw: 'Experienced software engineer.',
  experiences: [
    {
      id: 'exp_01',
      company: 'Acme Corp',
      title: 'Software Engineer',
      start: '2022-01',
      end: '2024-12',
      origin: 'extracted',
      bullets: [
        {
          id: 'b_01',
          text: 'Built REST APIs with Express, reduced load time by 30%',
          entities: {
            skills: ['REST', 'Express'],
            tools: ['Docker'],
            metrics: ['30%'],
            actions: ['built', 'reduced'],
          },
          origin: 'extracted',
        },
        {
          id: 'b_02',
          text: 'Developed React components for the dashboard, improving UX',
          entities: {
            skills: ['React'],
            tools: [],
            metrics: [],
            actions: ['developed'],
          },
          origin: 'extracted',
        },
        {
          id: 'b_03',
          text: 'Maintained CI/CD pipelines and worked in an Agile team',
          entities: {
            skills: ['CI/CD', 'Agile'],
            tools: [],
            metrics: [],
            actions: ['maintained'],
          },
          origin: 'extracted',
        },
      ],
    },
  ],
  skills: [
    { id: 'sk_01', name: 'React', proficiency_stated: 'none', origin: 'extracted' },
    { id: 'sk_02', name: 'Express', proficiency_stated: 'none', origin: 'extracted' },
    // TypeScript is user-attested (the parser missed it; user vouched for it)
    { id: 'sk_03', name: 'TypeScript', proficiency_stated: 'none', origin: 'attested' },
  ],
  projects: [],
  education: [],
  certifications: [],
  confirmed: true,
};

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
function makeValidator(inventoryOverride?: Partial<CandidateInventory>): Validator {
  return new Validator({ ...BASE_INVENTORY, ...inventoryOverride });
}

// ─────────────────────────────────────────────────────────────────
// § Spec test cases (CLAUDE.md §Testing priorities, spec §5 Stage 6)
// ─────────────────────────────────────────────────────────────────

describe('Stage 6 Validator — spec test cases', () => {

  // ── 1. Invented skill → fail ──────────────────────────────────
  describe('invented skill', () => {
    it('fails when a known tech term not in inventory appears in a bullet', () => {
      const v = makeValidator();
      // Kubernetes is in the synonym allowlist but NOT in the inventory
      const result = v.validateBullet('b_01', 'Deployed services using Kubernetes', 'Deployed services');
      expect(result.result).toBe('fail');
      expect(result.rule_violated).toBe('skill_not_in_inventory');
      expect(result.reason).toMatch(/Kubernetes/);
    });

    it('fails when surfacing an invented skill via validateSkill', () => {
      const v = makeValidator();
      const result = v.validateSkill('Kubernetes');
      expect(result.result).toBe('fail');
      expect(result.rule_violated).toBe('skill_not_in_inventory');
    });

    it('fails for an invented skill alias (k8s)', () => {
      const v = makeValidator();
      const result = v.validateBullet('b_01', 'Orchestrated deployments with k8s', 'Deployed services');
      expect(result.result).toBe('fail');
      expect(result.rule_violated).toBe('skill_not_in_inventory');
    });
  });

  // ── 2. Synonym-normalised skill → pass ───────────────────────
  describe('synonym-normalised skill', () => {
    it('passes when bullet uses alias "React.js" and inventory has canonical "React"', () => {
      const v = makeValidator();
      // React is in inventory; React.js is a synonym alias
      const result = v.validateBullet(
        'b_02',
        'Developed React.js components for the dashboard',
        'Developed React components for the dashboard, improving UX',
      );
      expect(result.result).toBe('pass');
    });

    it('passes when surfacing "ReactJS" (alias) via validateSkill', () => {
      const v = makeValidator();
      const result = v.validateSkill('ReactJS');
      expect(result.result).toBe('pass');
    });

    it('passes when bullet uses alias "Node" and Node.js is implied by Express', () => {
      const v = makeValidator();
      // Express ⇒ Node.js via implication rule; "Node" is a synonym alias for Node.js
      const result = v.validateBullet(
        'b_01',
        'Built REST APIs using Express and Node, reduced load time by 30%',
        'Built REST APIs with Express, reduced load time by 30%',
      );
      expect(result.result).toBe('pass');
    });
  });

  // ── 3. Curated implication → pass ────────────────────────────
  describe('curated implication', () => {
    it('passes when bullet uses Node.js implied by Express (impl_01)', () => {
      const v = makeValidator();
      // Express is in inventory → Node.js is a curated implication
      const result = v.validateBullet(
        'b_01',
        'Built REST APIs with Express on Node.js, reduced load time by 30%',
        'Built REST APIs with Express, reduced load time by 30%',
      );
      expect(result.result).toBe('pass');
    });

    it('passes when surfacing Node.js via validateSkill (implied by Express)', () => {
      const v = makeValidator();
      const result = v.validateSkill('Node.js');
      expect(result.result).toBe('pass');
    });

    it('passes when React is implied by Next.js (impl_05)', () => {
      const inventoryWithNextJs: CandidateInventory = {
        ...BASE_INVENTORY,
        skills: [{ id: 'sk_10', name: 'Next.js', proficiency_stated: 'none', origin: 'extracted' }],
      };
      const v = new Validator(inventoryWithNextJs);
      const result = v.validateSkill('React');
      expect(result.result).toBe('pass');
    });
  });

  // ── 4. User-attested skill → pass ────────────────────────────
  describe('user-attested skill', () => {
    it('passes when bullet uses an attested skill (TypeScript)', () => {
      const v = makeValidator();
      // TypeScript has origin: "attested" in the inventory
      const result = v.validateBullet(
        'b_01',
        'Built REST APIs with Express using TypeScript, reduced load time by 30%',
        'Built REST APIs with Express, reduced load time by 30%',
      );
      expect(result.result).toBe('pass');
    });

    it('passes when surfacing an attested skill via validateSkill', () => {
      const v = makeValidator();
      const result = v.validateSkill('TypeScript');
      expect(result.result).toBe('pass');
    });
  });

  // ── 5. Invented metric → fail ─────────────────────────────────
  describe('invented metric', () => {
    it('fails when a number in the rewrite does not appear in the source', () => {
      const v = makeValidator();
      // Source says "30%"; rewrite invents "50%"
      const result = v.validateBullet(
        'b_01',
        'Built REST APIs with Express, reduced load time by 50%',
        'Built REST APIs with Express, reduced load time by 30%',
      );
      expect(result.result).toBe('fail');
      expect(result.rule_violated).toBe('metric_invented');
      expect(result.reason).toMatch(/50%/);
    });

    it('fails when a metric is added from nowhere (source has none)', () => {
      const v = makeValidator();
      const result = v.validateBullet(
        'b_02',
        'Developed React components for the dashboard, improving UX by 40%',
        'Developed React components for the dashboard, improving UX',
      );
      expect(result.result).toBe('fail');
      expect(result.rule_violated).toBe('metric_invented');
    });

    it('fails when an integer is invented (source has no numbers)', () => {
      const v = makeValidator();
      const result = v.validateBullet(
        'b_02',
        'Developed 12 React components for the dashboard',
        'Developed React components for the dashboard, improving UX',
      );
      expect(result.result).toBe('fail');
      expect(result.rule_violated).toBe('metric_invented');
    });
  });

  // ── 6. Verbatim metric from source → pass ────────────────────
  describe('verbatim metric from source', () => {
    it('passes when the number in the rewrite appears verbatim in the source', () => {
      const v = makeValidator();
      // "30%" is in the source
      const result = v.validateBullet(
        'b_01',
        'Improved REST API performance with Express, achieving 30% faster load times',
        'Built REST APIs with Express, reduced load time by 30%',
      );
      expect(result.result).toBe('pass');
    });

    it('passes when source has no numbers and rewrite has no numbers', () => {
      const v = makeValidator();
      const result = v.validateBullet(
        'b_02',
        'Built React components to enhance the dashboard experience',
        'Developed React components for the dashboard, improving UX',
      );
      expect(result.result).toBe('pass');
    });
  });

  // ── 7. Proficiency upgrade → fail ────────────────────────────
  describe('proficiency upgrade', () => {
    it('fails when rewrite claims "expert" but source does not', () => {
      const v = makeValidator();
      const result = v.validateBullet(
        'b_01',
        'Expert-level REST API design with Express, reduced load time by 30%',
        'Built REST APIs with Express, reduced load time by 30%',
      );
      expect(result.result).toBe('fail');
      expect(result.rule_violated).toBe('proficiency_inflated');
      expect(result.reason).toMatch(/expert/i);
    });

    it('fails when rewrite claims "mastery" but source does not', () => {
      const v = makeValidator();
      const result = v.validateBullet(
        'b_02',
        'Demonstrated mastery of React in building dashboard components',
        'Developed React components for the dashboard, improving UX',
      );
      expect(result.result).toBe('fail');
      expect(result.rule_violated).toBe('proficiency_inflated');
    });

    it('fails when rewrite claims "architected" but source does not', () => {
      const v = makeValidator();
      const result = v.validateBullet(
        'b_01',
        'Architected REST API solutions with Express, reduced load time by 30%',
        'Built REST APIs with Express, reduced load time by 30%',
      );
      expect(result.result).toBe('fail');
      expect(result.rule_violated).toBe('proficiency_inflated');
    });
  });

  // ── 8. Unchanged proficiency → pass ──────────────────────────
  describe('unchanged proficiency', () => {
    it('passes when rewrite does not add proficiency terms absent from source', () => {
      const v = makeValidator();
      const result = v.validateBullet(
        'b_02',
        'Built React components for the dashboard, improving overall user experience',
        'Developed React components for the dashboard, improving UX',
      );
      expect(result.result).toBe('pass');
    });

    it('passes when a proficiency word appears in both source and rewrite', () => {
      const v = makeValidator();
      // Source already says "expert" — rewrite repeating it is allowed
      const result = v.validateBullet(
        'b_01',
        'Applied expert React skills to build reusable components',
        'Applied expert React skills to build reusable components',
      );
      expect(result.result).toBe('pass');
    });
  });

});

// ─────────────────────────────────────────────────────────────────
// § validatePlan — integration across bullets + surfaced skills
// ─────────────────────────────────────────────────────────────────

describe('Validator.validatePlan', () => {
  const CLEAN_PLAN: RepositionPlan = {
    summary: {
      text: 'Experienced engineer with React and Express expertise.',
      source_ids: ['exp_01', 'sk_01', 'sk_02'],
      change_type: 'resummarised',
    },
    experiences_order: ['exp_01'],
    bullets: [
      {
        source_id: 'b_01',
        original: 'Built REST APIs with Express, reduced load time by 30%',
        rewritten: 'Designed REST APIs with Express, improving response times by 30%',
        change_type: 'reworded',
        rationale: 'surfaces API design work',
        validated: false,
      },
    ],
    surfaced_skills: [
      { skill_name: 'Docker', source_id: 'b_01', change_type: 'surfaced' },
    ],
    skills_order: ['sk_01', 'sk_02'],
    dropped: [],
  };

  it('returns zero fabricated units for a clean plan', () => {
    const v = makeValidator();
    const report = v.validatePlan(CLEAN_PLAN);
    expect(report.ai_change_summary.fabricated).toBe(0);
    expect(report.results.every((r) => r.result === 'pass')).toBe(true);
  });

  it('counts fabricated units correctly when a bullet has an invented metric', () => {
    const v = makeValidator();
    const plan: RepositionPlan = {
      ...CLEAN_PLAN,
      bullets: [
        {
          source_id: 'b_01',
          original: 'Built REST APIs with Express, reduced load time by 30%',
          rewritten: 'Built REST APIs with Express, reduced load time by 80%', // invented 80%
          change_type: 'reworded',
          rationale: '',
          validated: false,
        },
      ],
    };
    const report = v.validatePlan(plan);
    expect(report.ai_change_summary.fabricated).toBe(1);
    const failed = report.results.filter((r) => r.result === 'fail');
    expect(failed.length).toBe(1);
    expect(failed[0].rule_violated).toBe('metric_invented');
  });

  it('counts fabricated units correctly when a surfaced skill is not permitted', () => {
    const v = makeValidator();
    const plan: RepositionPlan = {
      ...CLEAN_PLAN,
      bullets: [],
      surfaced_skills: [
        { skill_name: 'Kubernetes', source_id: 'b_01', change_type: 'surfaced' },
      ],
    };
    const report = v.validatePlan(plan);
    expect(report.ai_change_summary.fabricated).toBe(1);
    const failed = report.results.filter((r) => r.result === 'fail');
    expect(failed.length).toBe(1);
    expect(failed[0].rule_violated).toBe('skill_not_in_inventory');
  });

  it('tracks ai_change_summary and user_change_summary correctly', () => {
    const v = makeValidator();
    const report = v.validatePlan(CLEAN_PLAN);

    // 1 experience in experiences_order
    expect(report.ai_change_summary.repositioned).toBe(1);
    // 1 bullet with change_type: 'reworded'
    expect(report.ai_change_summary.reworded).toBe(1);
    // 1 skill with change_type: 'surfaced' (Docker)
    expect(report.ai_change_summary.surfaced).toBe(1);
    expect(report.ai_change_summary.implied).toBe(0);

    // 1 attested skill (TypeScript) in BASE_INVENTORY
    expect(report.user_change_summary.attested).toBe(1);
    // No edited items in BASE_INVENTORY
    expect(report.user_change_summary.edited).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// § Latent skill detection (bullet entities, not Skills section)
// ─────────────────────────────────────────────────────────────────

describe('Validator — latent skills (in bullet entities, not Skills section)', () => {
  it('passes when surfacing Docker — present in bullet entities even though not in Skills section', () => {
    const v = makeValidator();
    // Docker appears in b_01's entities.tools but NOT in inventory.skills
    const result = v.validateSkill('Docker');
    expect(result.result).toBe('pass');
  });

  it('fails when surfacing AWS — not in inventory or bullet entities', () => {
    const v = makeValidator();
    const result = v.validateSkill('AWS');
    expect(result.result).toBe('fail');
    expect(result.rule_violated).toBe('skill_not_in_inventory');
  });
});

// ─────────────────────────────────────────────────────────────────
// § Gate: Phase B gate (inventoryConfirmed must be true)
// ─────────────────────────────────────────────────────────────────

describe('Validator — input contract', () => {
  it('handles an inventory with no skills gracefully (empty permitted set)', () => {
    const emptyInventory: CandidateInventory = {
      ...BASE_INVENTORY,
      skills: [],
      experiences: [],
      projects: [],
    };
    const v = new Validator(emptyInventory);
    // No skills in inventory — any known tech term → fail
    const result = v.validateSkill('React');
    expect(result.result).toBe('fail');
  });

  it('handles a rewrite with no numbers and no known tech terms (plain prose) as pass', () => {
    const v = makeValidator();
    const result = v.validateBullet('b_02', 'Collaborated with cross-functional teams to ship product features on time', null);
    expect(result.result).toBe('pass');
  });
});
