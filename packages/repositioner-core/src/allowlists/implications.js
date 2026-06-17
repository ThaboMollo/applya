"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IMPLICATION_RULES = void 0;
exports.getImpliedSkills = getImpliedSkills;
exports.IMPLICATION_RULES = [
    {
        id: 'impl_01',
        antecedent: 'Express',
        implies: 'Node.js',
        note: 'Express is a Node.js framework; using Express requires Node.js',
    },
    {
        id: 'impl_02',
        antecedent: 'NestJS',
        implies: 'Node.js',
        note: 'NestJS runs on Node.js; using NestJS requires Node.js',
    },
    {
        id: 'impl_03',
        antecedent: 'Next.js',
        implies: 'Node.js',
        note: 'Next.js runs on Node.js; using Next.js requires Node.js',
    },
    {
        id: 'impl_04',
        antecedent: 'NestJS',
        implies: 'TypeScript',
        note: 'NestJS is built on TypeScript and its standard usage is TypeScript',
    },
    {
        id: 'impl_05',
        antecedent: 'Next.js',
        implies: 'React',
        note: 'Next.js is built on React; using Next.js requires React knowledge',
    },
    {
        id: 'impl_06',
        antecedent: 'React Native',
        implies: 'React',
        note: 'React Native is built on React; using React Native requires React knowledge',
    },
    {
        id: 'impl_07',
        antecedent: 'Gatsby',
        implies: 'React',
        note: 'Gatsby is a React-based framework',
    },
    {
        id: 'impl_08',
        antecedent: 'Remix',
        implies: 'React',
        note: 'Remix is a React framework',
    },
    {
        id: 'impl_09',
        antecedent: 'Django',
        implies: 'Python',
        note: 'Django is a Python web framework',
    },
    {
        id: 'impl_10',
        antecedent: 'FastAPI',
        implies: 'Python',
        note: 'FastAPI is a Python web framework',
    },
    {
        id: 'impl_11',
        antecedent: 'Flask',
        implies: 'Python',
        note: 'Flask is a Python web framework',
    },
    {
        id: 'impl_12',
        antecedent: 'NumPy',
        implies: 'Python',
        note: 'NumPy is a Python library',
    },
    {
        id: 'impl_13',
        antecedent: 'Pandas',
        implies: 'Python',
        note: 'Pandas is a Python library',
    },
    {
        id: 'impl_14',
        antecedent: 'PyTorch',
        implies: 'Python',
        note: 'PyTorch is a Python ML framework',
    },
    {
        id: 'impl_15',
        antecedent: 'TensorFlow',
        implies: 'Python',
        note: 'TensorFlow primary interface is Python',
    },
    {
        id: 'impl_16',
        antecedent: 'scikit-learn',
        implies: 'Python',
        note: 'scikit-learn is a Python ML library',
    },
    {
        id: 'impl_17',
        antecedent: 'Spring Boot',
        implies: 'Java',
        note: 'Spring Boot is a Java framework',
    },
    {
        id: 'impl_18',
        antecedent: 'Spring',
        implies: 'Java',
        note: 'Spring Framework is a Java framework',
    },
    {
        id: 'impl_19',
        antecedent: 'Laravel',
        implies: 'PHP',
        note: 'Laravel is a PHP framework',
    },
    {
        id: 'impl_20',
        antecedent: 'Symfony',
        implies: 'PHP',
        note: 'Symfony is a PHP framework',
    },
    {
        id: 'impl_21',
        antecedent: 'Prisma',
        implies: 'TypeScript',
        note: 'Prisma ORM is TypeScript-first; its standard usage is TypeScript',
    },
    {
        id: 'impl_22',
        antecedent: 'Nuxt',
        implies: 'Vue',
        note: 'Nuxt is built on Vue.js',
    },
];
function getImpliedSkills(inventorySkillNames, rules = exports.IMPLICATION_RULES) {
    const skillSet = new Set(inventorySkillNames.map((s) => s.toLowerCase()));
    const results = [];
    for (const rule of rules) {
        if (skillSet.has(rule.antecedent.toLowerCase())) {
            results.push({ implied: rule.implies, ruleId: rule.id, antecedent: rule.antecedent });
        }
    }
    return results;
}
//# sourceMappingURL=implications.js.map