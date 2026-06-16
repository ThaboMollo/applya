/**
 * Prisma seed — populates the synonym and implication allowlists.
 * Run: yarn db:seed
 *
 * These lists must be seeded before Stage 6 runs in production (§14).
 * An empty list makes Stage 6 hostile on day one (flags React.js vs React as fabrication).
 */
import { PrismaClient } from '@prisma/client';
import { SYNONYM_GROUPS } from '../../repositioner-core/src/allowlists/synonyms';
import { IMPLICATION_RULES } from '../../repositioner-core/src/allowlists/implications';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding synonym groups...');
  for (const group of SYNONYM_GROUPS) {
    await prisma.synonymGroup.upsert({
      where: { canonical: group.canonical },
      update: { aliases: group.aliases },
      create: { canonical: group.canonical, aliases: group.aliases },
    });
  }
  console.log(`Seeded ${SYNONYM_GROUPS.length} synonym groups.`);

  console.log('Seeding implication rules...');
  for (const rule of IMPLICATION_RULES) {
    await prisma.implicationRule.upsert({
      where: { antecedent_implies: { antecedent: rule.antecedent, implies: rule.implies } },
      update: { note: rule.note },
      create: { antecedent: rule.antecedent, implies: rule.implies, note: rule.note },
    });
  }
  console.log(`Seeded ${IMPLICATION_RULES.length} implication rules.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
