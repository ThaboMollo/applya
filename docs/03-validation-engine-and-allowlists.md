# Phase 3 — Validation Engine & Allowlists

**Spec references:** §5 Stage 6, §6 (anti-fabrication guarantees), §14 (cold-start risk)
**Depends on:** Phase 1 (inventory schema), Phase 2 (confirmed inventory with origin tags).
**Produces:** A deterministic, fully unit-tested `Validator` that accepts or rejects every generated unit — the integrity guarantee in code.

---

## 1. What this phase delivers

The programmatic validator (Stage 6) and the two curated data sets it depends on: the synonym allowlist and the implication allowlist. This phase is built **before generation** (Phase 5) so the guarantee exists before any LLM output is produced. The validator is pure TypeScript, zero LLM calls, and fully unit-testable.

---

## 2. Seeding the synonym allowlist

### 2.1 Purpose

The synonym list prevents the validator from flagging legitimate terminology variations as fabrication. Without it, the validator would reject "React" when the inventory says "React.js" — a false positive that destroys usability.

### 2.2 Data model

```prisma
model SynonymRule {
  id        String   @id @default(cuid())
  canonical String           // "React"
  aliases   String[]         // ["React.js", "ReactJS", "React JS"]
}
```

### 2.3 Starter seed data

Seed with a curated set covering the most common tech-resume terminology variations. This is **not** LLM-generated — it is hand-written and reviewed.

```typescript
// packages/repositioner-core/src/data/synonym-seed.ts
export const SYNONYM_SEED: { canonical: string; aliases: string[] }[] = [
  { canonical: "JavaScript",   aliases: ["JS", "ECMAScript", "ES6", "ES2015+"] },
  { canonical: "TypeScript",   aliases: ["TS"] },
  { canonical: "React",        aliases: ["React.js", "ReactJS", "React JS"] },
  { canonical: "Node.js",      aliases: ["Node", "NodeJS"] },
  { canonical: "Next.js",      aliases: ["NextJS", "Next"] },
  { canonical: "Vue.js",       aliases: ["Vue", "VueJS"] },
  { canonical: "Angular",      aliases: ["AngularJS", "Angular.js"] },
  { canonical: "PostgreSQL",   aliases: ["Postgres", "PG"] },
  { canonical: "MongoDB",      aliases: ["Mongo"] },
  { canonical: "Amazon Web Services", aliases: ["AWS"] },
  { canonical: "Google Cloud Platform", aliases: ["GCP", "Google Cloud"] },
  { canonical: "Microsoft Azure", aliases: ["Azure"] },
  { canonical: "Docker",       aliases: ["Docker Engine", "Docker CE"] },
  { canonical: "Kubernetes",   aliases: ["K8s", "k8s"] },
  { canonical: "CI/CD",        aliases: ["CI", "CD", "Continuous Integration", "Continuous Delivery", "Continuous Deployment"] },
  { canonical: "REST",         aliases: ["REST API", "REST APIs", "RESTful", "RESTful API"] },
  { canonical: "GraphQL",      aliases: ["GQL"] },
  { canonical: "Tailwind CSS", aliases: ["TailwindCSS", "Tailwind"] },
  { canonical: "Sass",         aliases: ["SCSS", "Sass/SCSS"] },
  { canonical: "Python",       aliases: ["Python 3", "Python3"] },
  { canonical: "Java",         aliases: [] },  // intentionally no aliases to avoid Java/JavaScript confusion
  { canonical: "C#",           aliases: ["CSharp", "C Sharp"] },
  { canonical: ".NET",         aliases: ["dotnet", "DotNet", ".NET Core", ".NET Framework"] },
  { canonical: "Git",          aliases: ["git"] },
  { canonical: "GitHub",       aliases: ["Github"] },
  { canonical: "GitLab",       aliases: ["Gitlab"] },
  { canonical: "MySQL",        aliases: ["mysql"] },
  { canonical: "Redis",        aliases: ["redis"] },
  { canonical: "Terraform",    aliases: ["TF"] },
  // ... extend from real pilot resumes
];
```

### 2.4 Lookup implementation

```typescript
// packages/repositioner-core/src/utils/synonym-resolver.ts
export class SynonymResolver {
  private aliasToCanonical: Map<string, string>;

  constructor(rules: SynonymRule[]) {
    this.aliasToCanonical = new Map();
    for (const rule of rules) {
      // Map each alias (lowercased) to the canonical form
      this.aliasToCanonical.set(rule.canonical.toLowerCase(), rule.canonical);
      for (const alias of rule.aliases) {
        this.aliasToCanonical.set(alias.toLowerCase(), rule.canonical);
      }
    }
  }

  /**
   * Returns the canonical form if the term matches a known synonym.
   * Returns the original term if no synonym is found.
   */
  resolve(term: string): string {
    return this.aliasToCanonical.get(term.toLowerCase()) ?? term;
  }

  /**
   * Returns true if two terms are synonymous.
   */
  areSynonymous(a: string, b: string): boolean {
    return this.resolve(a) === this.resolve(b);
  }
}
```

---

## 3. Seeding the implication allowlist

### 3.1 Purpose

The implication list is what makes "surface latent skills" work honestly. If the inventory says "Express" and the JD asks for "Node.js", the validator needs to know that Express implies Node.js — but it must **not** infer arbitrary relationships (e.g., "AWS" does NOT imply "DevOps").

### 3.2 Data model

```prisma
model ImplicationRule {
  id         String  @id @default(cuid())
  antecedent String          // "Express"  (must be in the inventory)
  implies    String          // "Node.js"
  note       String?         // "Express is a Node.js framework"
}
```

### 3.3 The conservatism principle

Every rule in this list must satisfy: **if someone uses the antecedent, they have necessarily used the implied skill.** This is a near-certain technical relationship, not a "might know" correlation.

✅ **Good implications (near-certain):**
- Express → Node.js (Express is a Node.js framework)
- Next.js → React (Next.js is built on React)
- NestJS → Node.js, TypeScript
- Django → Python
- Flask → Python
- Spring Boot → Java
- Rails → Ruby
- SwiftUI → Swift
- Jetpack Compose → Kotlin
- React Native → React, JavaScript

❌ **Bad implications (too loose):**
- AWS → DevOps (using AWS ≠ doing DevOps)
- Docker → Kubernetes (containers ≠ orchestration)
- Python → Machine Learning (Python is general-purpose)
- JavaScript → TypeScript (not necessarily)

### 3.4 Starter seed data

```typescript
// packages/repositioner-core/src/data/implication-seed.ts
export const IMPLICATION_SEED: { antecedent: string; implies: string; note: string }[] = [
  { antecedent: "Express",        implies: "Node.js",      note: "Express is a Node.js web framework" },
  { antecedent: "Express.js",     implies: "Node.js",      note: "Express alias" },
  { antecedent: "NestJS",         implies: "Node.js",      note: "NestJS is a Node.js framework" },
  { antecedent: "NestJS",         implies: "TypeScript",   note: "NestJS is TypeScript-first" },
  { antecedent: "Next.js",        implies: "React",        note: "Next.js is a React framework" },
  { antecedent: "Nuxt",           implies: "Vue.js",       note: "Nuxt is a Vue.js framework" },
  { antecedent: "Nuxt",           implies: "JavaScript",   note: "Nuxt runs on JavaScript" },
  { antecedent: "Gatsby",         implies: "React",        note: "Gatsby is a React framework" },
  { antecedent: "Django",         implies: "Python",       note: "Django is a Python framework" },
  { antecedent: "Flask",          implies: "Python",       note: "Flask is a Python framework" },
  { antecedent: "FastAPI",        implies: "Python",       note: "FastAPI is a Python framework" },
  { antecedent: "Spring Boot",    implies: "Java",         note: "Spring Boot is a Java framework" },
  { antecedent: "Rails",          implies: "Ruby",         note: "Rails is a Ruby framework" },
  { antecedent: "Ruby on Rails",  implies: "Ruby",         note: "Rails alias" },
  { antecedent: "Laravel",        implies: "PHP",          note: "Laravel is a PHP framework" },
  { antecedent: "SwiftUI",        implies: "Swift",        note: "SwiftUI is a Swift framework" },
  { antecedent: "Jetpack Compose",implies: "Kotlin",       note: "Jetpack Compose is Kotlin-based" },
  { antecedent: "React Native",   implies: "React",        note: "React Native uses React" },
  { antecedent: "React Native",   implies: "JavaScript",   note: "React Native runs on JavaScript" },
  { antecedent: "Prisma",         implies: "Node.js",      note: "Prisma is a Node.js ORM" },
  { antecedent: "Sequelize",      implies: "Node.js",      note: "Sequelize is a Node.js ORM" },
  { antecedent: "TypeORM",        implies: "TypeScript",   note: "TypeORM is TypeScript-first" },
  { antecedent: "TypeORM",        implies: "Node.js",      note: "TypeORM is a Node.js ORM" },
  // ... grow from pilot cases
];
```

---

## 4. The Validator

### 4.1 Architecture

The validator is a pure function: it takes a rewritten unit (bullet, skill, summary) and the confirmed inventory, and returns `pass | fail(reasons)`.

```typescript
// packages/repositioner-core/src/stages/stage6-validator.ts

export interface ValidationResult {
  unitId: string;           // the source_id of the unit being checked
  status: "pass" | "fail";
  violations: Violation[];
}

export interface Violation {
  type: "unknown_entity" | "invented_metric" | "proficiency_inflation" | "unknown_source_id";
  detail: string;           // human-readable explanation
  entity?: string;          // the offending entity
}

export class Validator {
  constructor(
    private inventory: CandidateInventory,
    private synonymResolver: SynonymResolver,
    private implicationRules: ImplicationRule[],
  ) {}

  validateUnit(unit: RepositionedUnit): ValidationResult { ... }
  validatePlan(plan: RepositionPlan): ValidationResult[] { ... }
}
```

### 4.2 Validation checks (in order)

**Check 1 — Source ID exists:**
Every unit must reference a `source_id` that exists in the confirmed inventory.

```typescript
private checkSourceIdExists(unit: RepositionedUnit): Violation | null {
  const exists = this.findInventoryItem(unit.source_id);
  if (!exists) {
    return { type: "unknown_source_id", detail: `source_id "${unit.source_id}" not found in inventory` };
  }
  return null;
}
```

**Check 2 — Entity allowlist:**
Extract every skill/tool/company/title from the rewritten text. Each must be:
1. Present in the inventory (exact match or synonym), **OR**
2. Implied by something in the inventory (via the implication list), **OR**
3. User-attested.

```typescript
private checkEntities(unit: RepositionedUnit): Violation[] {
  const violations: Violation[] = [];
  const entities = this.extractEntities(unit.rewritten);

  for (const entity of entities) {
    const canonical = this.synonymResolver.resolve(entity);

    // Check 1: Is it in the inventory?
    if (this.isInInventory(canonical)) continue;

    // Check 2: Is it implied by something in the inventory?
    if (this.isImplied(canonical)) continue;

    // Check 3: Is it user-attested?
    if (this.isAttested(canonical)) continue;

    violations.push({
      type: "unknown_entity",
      detail: `"${entity}" not found in inventory, not implied, and not attested`,
      entity,
    });
  }
  return violations;
}
```

**Check 3 — Numeric token fidelity:**
Every number, percentage, metric in the rewritten text must exist verbatim in the source bullet text.

```typescript
private checkMetrics(unit: RepositionedUnit): Violation[] {
  const violations: Violation[] = [];
  const sourceText = this.getSourceText(unit.source_id);
  const rewrittenNumbers = this.extractNumericTokens(unit.rewritten);
  const sourceNumbers = this.extractNumericTokens(sourceText);

  for (const num of rewrittenNumbers) {
    if (!sourceNumbers.includes(num)) {
      violations.push({
        type: "invented_metric",
        detail: `Numeric token "${num}" appears in rewrite but not in source text`,
        entity: num,
      });
    }
  }
  return violations;
}
```

**Check 4 — Proficiency guard:**
If the source item has `proficiency_stated: "none"` or a specific level, the rewrite must not upgrade it.

```typescript
private checkProficiency(unit: RepositionedUnit): Violation[] {
  const UPGRADE_WORDS = ["expert", "mastery", "advanced", "lead", "led", "architected", "senior"];
  const source = this.findInventoryItem(unit.source_id);

  if (source?.proficiency_stated === "none" || source?.proficiency_stated === "beginner" || source?.proficiency_stated === "familiar") {
    for (const word of UPGRADE_WORDS) {
      if (unit.rewritten.toLowerCase().includes(word) && !source.text?.toLowerCase().includes(word)) {
        return [{
          type: "proficiency_inflation",
          detail: `"${word}" implies higher proficiency than source states ("${source.proficiency_stated}")`,
          entity: word,
        }];
      }
    }
  }
  return [];
}
```

### 4.3 Entity extraction utility

```typescript
// packages/repositioner-core/src/utils/entity-extractor.ts
export function extractEntities(text: string): string[] {
  // 1. Extract capitalised multi-word terms (e.g., "REST APIs", "Node.js")
  // 2. Extract terms matching known patterns (acronyms, dotted names like "Vue.js")
  // 3. Cross-reference against a known tech-terms list for higher recall
  // Return de-duplicated list
}

export function extractNumericTokens(text: string): string[] {
  // Match: "30%", "3x", "$50K", "10,000", "2.5 years", etc.
  // Return the full token including unit/symbol
}
```

---

## 5. Handling validation failures

When the validator returns `fail` for a unit, the pipeline has two options (configured per violation type):

| Violation type | Default action |
|----------------|----------------|
| `unknown_entity` | Auto-strip the entity from the rewritten text if possible; if the entity is central to the bullet, flag for regeneration |
| `invented_metric` | Revert to original bullet text (never ship an invented number) |
| `proficiency_inflation` | Flag for Stage 7 (LLM judge) for semantic review; if judge agrees, revert |
| `unknown_source_id` | Reject the entire unit — something went wrong in generation |

---

## 6. Unit tests (the integrity guarantee)

This is the most test-dense component in the system. Every anti-fabrication guarantee from the spec's §6 table must have a corresponding test.

### 6.1 Test categories

**Must-fail tests (fabrication caught):**
```typescript
describe("Validator catches fabrication", () => {
  test("rejects a skill not in the inventory", () => {
    // Inventory has: React, TypeScript, Docker
    // Rewrite mentions: Kubernetes
    // → fail: unknown_entity "Kubernetes"
  });

  test("rejects an invented metric", () => {
    // Source bullet: "Improved API response times"
    // Rewrite: "Improved API response times by 40%"
    // → fail: invented_metric "40%"
  });

  test("rejects proficiency inflation", () => {
    // Source: proficiency_stated: "familiar"
    // Rewrite: "Expert in TypeScript"
    // → fail: proficiency_inflation "expert"
  });

  test("rejects an entity not in inventory and not implied", () => {
    // Inventory has: AWS
    // Rewrite mentions: DevOps
    // → fail: unknown_entity "DevOps" (no implication rule for AWS → DevOps)
  });
});
```

**Must-pass tests (legitimate changes allowed):**
```typescript
describe("Validator allows legitimate changes", () => {
  test("allows a synonym variation", () => {
    // Inventory has: "React.js"
    // Rewrite uses: "React"
    // → pass (synonym rule matches)
  });

  test("allows a curated implication", () => {
    // Inventory has: "Express"
    // Rewrite mentions: "Node.js"
    // → pass (implication rule: Express → Node.js)
  });

  test("allows a user-attested skill", () => {
    // Inventory has: { name: "Kubernetes", origin: "attested" }
    // Rewrite mentions: "Kubernetes"
    // → pass
  });

  test("allows metrics that exist in the source", () => {
    // Source: "reduced load time by 30%"
    // Rewrite: "Achieved a 30% reduction in page load time"
    // → pass (30% exists in source)
  });

  test("allows unchanged bullets", () => {
    // change_type: "unchanged"
    // → pass (skip validation entirely for untouched bullets)
  });
});
```

---

## 7. Verification checklist

- [ ] Synonym resolver correctly matches all seeded aliases to their canonical forms.
- [ ] Implication resolver correctly identifies valid implications (Express → Node.js) and rejects invalid ones.
- [ ] Validator correctly rejects hallucinated skills, invented metrics, and proficiency inflation.
- [ ] Validator correctly allows synonyms, implications, and attested skills.
- [ ] All must-fail and must-pass unit tests pass.
- [ ] The seed data is loaded into the database via a migration/seed script.
- [ ] Seed data is version-controlled (not generated at runtime).
