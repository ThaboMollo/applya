"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYNONYM_GROUPS = void 0;
exports.buildSynonymLookup = buildSynonymLookup;
exports.resolveCanonical = resolveCanonical;
exports.SYNONYM_GROUPS = [
    { canonical: 'JavaScript', aliases: ['JS', 'ECMAScript', 'ES6', 'ES2015', 'ES2016', 'ES2017', 'ES2018', 'ES2019', 'ES2020', 'ES2021', 'ES2022', 'ESNext'] },
    { canonical: 'TypeScript', aliases: ['TS'] },
    { canonical: 'Python', aliases: ['Py', 'Python3', 'Python 3'] },
    { canonical: 'C#', aliases: ['CSharp', 'C Sharp', 'dotnet', '.NET C#'] },
    { canonical: 'C++', aliases: ['CPP', 'C Plus Plus'] },
    { canonical: 'React', aliases: ['React.js', 'ReactJS', 'React JS'] },
    { canonical: 'Vue', aliases: ['Vue.js', 'VueJS', 'Vue JS', 'Vue 3', 'Vue 2'] },
    { canonical: 'Angular', aliases: ['AngularJS', 'Angular.js', 'Angular 2+'] },
    { canonical: 'Svelte', aliases: ['SvelteKit', 'Svelte Kit'] },
    { canonical: 'Next.js', aliases: ['NextJS', 'Next JS', 'Next'] },
    { canonical: 'Nuxt', aliases: ['Nuxt.js', 'NuxtJS', 'Nuxt JS', 'Nuxt 3'] },
    { canonical: 'Node.js', aliases: ['NodeJS', 'Node JS', 'Node'] },
    { canonical: 'Express', aliases: ['Express.js', 'ExpressJS', 'Express JS'] },
    { canonical: 'NestJS', aliases: ['Nest.js', 'Nest JS', 'Nest'] },
    { canonical: 'FastAPI', aliases: ['Fast API'] },
    { canonical: 'Django', aliases: ['Django REST', 'DRF'] },
    { canonical: 'Flask', aliases: ['Flask API'] },
    { canonical: 'Spring Boot', aliases: ['SpringBoot', 'Spring', 'Spring Framework'] },
    { canonical: 'PostgreSQL', aliases: ['Postgres', 'PG', 'Postgresql', 'pg'] },
    { canonical: 'MySQL', aliases: ['My SQL', 'MariaDB'] },
    { canonical: 'MongoDB', aliases: ['Mongo', 'Mongo DB'] },
    { canonical: 'Redis', aliases: ['RedisDB', 'Redis Cache'] },
    { canonical: 'SQLite', aliases: ['SQLite3', 'Sqlite'] },
    { canonical: 'Elasticsearch', aliases: ['Elastic Search', 'ES', 'OpenSearch'] },
    { canonical: 'AWS', aliases: ['Amazon Web Services', 'Amazon AWS'] },
    { canonical: 'GCP', aliases: ['Google Cloud', 'Google Cloud Platform', 'Google Cloud Services'] },
    { canonical: 'Azure', aliases: ['Microsoft Azure', 'Azure Cloud'] },
    { canonical: 'Docker', aliases: ['Docker Container', 'Docker containers'] },
    { canonical: 'Kubernetes', aliases: ['K8s', 'k8s', 'K8'] },
    { canonical: 'Terraform', aliases: ['TF', 'Terraform IaC'] },
    { canonical: 'CI/CD', aliases: ['Continuous Integration', 'Continuous Deployment', 'Continuous Delivery', 'CI / CD', 'CICD'] },
    { canonical: 'GitHub Actions', aliases: ['GH Actions', 'Github Actions'] },
    { canonical: 'Jenkins', aliases: ['Jenkins CI', 'Jenkins CD'] },
    { canonical: 'Jest', aliases: ['Jest.js', 'JestJS'] },
    { canonical: 'Cypress', aliases: ['Cypress.io', 'Cypress E2E'] },
    { canonical: 'Playwright', aliases: ['MS Playwright'] },
    { canonical: 'Vitest', aliases: ['Vite Test'] },
    { canonical: 'REST', aliases: ['RESTful', 'REST APIs', 'REST API', 'RESTful APIs', 'RESTful API'] },
    { canonical: 'GraphQL', aliases: ['GQL', 'Graph QL'] },
    { canonical: 'gRPC', aliases: ['GRPC', 'G RPC'] },
    { canonical: 'WebSockets', aliases: ['WebSocket', 'Web Sockets', 'WS'] },
    { canonical: 'Git', aliases: ['version control', 'Git SCM'] },
    { canonical: 'Linux', aliases: ['Ubuntu', 'CentOS', 'Debian', 'Bash'] },
    { canonical: 'Vercel', aliases: ['Vercel Edge'] },
    { canonical: 'Supabase', aliases: ['Supabase BaaS'] },
    { canonical: 'Prisma', aliases: ['Prisma ORM', 'PrismaJS'] },
    { canonical: 'Tailwind CSS', aliases: ['Tailwind', 'TailwindCSS', 'Tailwind CSS Framework'] },
    { canonical: 'TensorFlow', aliases: ['TF', 'Tensorflow'] },
    { canonical: 'PyTorch', aliases: ['Py Torch', 'torch'] },
    { canonical: 'scikit-learn', aliases: ['sklearn', 'scikit learn', 'Scikit-Learn'] },
    { canonical: 'NumPy', aliases: ['Numpy', 'np'] },
    { canonical: 'Pandas', aliases: ['pandas', 'pd'] },
    { canonical: 'Agile', aliases: ['Agile Methodology', 'Agile Development'] },
    { canonical: 'Scrum', aliases: ['Scrum Framework', 'Scrum Methodology'] },
];
function buildSynonymLookup(groups = exports.SYNONYM_GROUPS) {
    const map = new Map();
    for (const group of groups) {
        map.set(group.canonical.toLowerCase(), group.canonical);
        for (const alias of group.aliases) {
            map.set(alias.toLowerCase(), group.canonical);
        }
    }
    return map;
}
function resolveCanonical(term, lookup) {
    const l = lookup ?? buildSynonymLookup();
    return l.get(term.toLowerCase()) ?? term;
}
//# sourceMappingURL=synonyms.js.map