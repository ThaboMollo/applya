import { z } from 'zod';
declare const ItemOrigin: z.ZodEnum<["extracted", "attested", "edited"]>;
export declare const EntitySchema: z.ZodObject<{
    skills: z.ZodArray<z.ZodString, "many">;
    tools: z.ZodArray<z.ZodString, "many">;
    metrics: z.ZodArray<z.ZodString, "many">;
    actions: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    skills: string[];
    tools: string[];
    metrics: string[];
    actions: string[];
}, {
    skills: string[];
    tools: string[];
    metrics: string[];
    actions: string[];
}>;
export declare const BulletSchema: z.ZodObject<{
    id: z.ZodString;
    text: z.ZodString;
    entities: z.ZodObject<{
        skills: z.ZodArray<z.ZodString, "many">;
        tools: z.ZodArray<z.ZodString, "many">;
        metrics: z.ZodArray<z.ZodString, "many">;
        actions: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        skills: string[];
        tools: string[];
        metrics: string[];
        actions: string[];
    }, {
        skills: string[];
        tools: string[];
        metrics: string[];
        actions: string[];
    }>;
    confidence: z.ZodOptional<z.ZodNumber>;
    origin: z.ZodDefault<z.ZodEnum<["extracted", "attested", "edited"]>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    text: string;
    entities: {
        skills: string[];
        tools: string[];
        metrics: string[];
        actions: string[];
    };
    origin: "extracted" | "attested" | "edited";
    confidence?: number | undefined;
}, {
    id: string;
    text: string;
    entities: {
        skills: string[];
        tools: string[];
        metrics: string[];
        actions: string[];
    };
    confidence?: number | undefined;
    origin?: "extracted" | "attested" | "edited" | undefined;
}>;
export declare const ExperienceSchema: z.ZodObject<{
    id: z.ZodString;
    company: z.ZodString;
    title: z.ZodString;
    start: z.ZodString;
    end: z.ZodString;
    bullets: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        text: z.ZodString;
        entities: z.ZodObject<{
            skills: z.ZodArray<z.ZodString, "many">;
            tools: z.ZodArray<z.ZodString, "many">;
            metrics: z.ZodArray<z.ZodString, "many">;
            actions: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            skills: string[];
            tools: string[];
            metrics: string[];
            actions: string[];
        }, {
            skills: string[];
            tools: string[];
            metrics: string[];
            actions: string[];
        }>;
        confidence: z.ZodOptional<z.ZodNumber>;
        origin: z.ZodDefault<z.ZodEnum<["extracted", "attested", "edited"]>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        text: string;
        entities: {
            skills: string[];
            tools: string[];
            metrics: string[];
            actions: string[];
        };
        origin: "extracted" | "attested" | "edited";
        confidence?: number | undefined;
    }, {
        id: string;
        text: string;
        entities: {
            skills: string[];
            tools: string[];
            metrics: string[];
            actions: string[];
        };
        confidence?: number | undefined;
        origin?: "extracted" | "attested" | "edited" | undefined;
    }>, "many">;
    confidence: z.ZodOptional<z.ZodNumber>;
    origin: z.ZodDefault<z.ZodEnum<["extracted", "attested", "edited"]>>;
}, "strip", z.ZodTypeAny, {
    end: string;
    id: string;
    origin: "extracted" | "attested" | "edited";
    company: string;
    title: string;
    start: string;
    bullets: {
        id: string;
        text: string;
        entities: {
            skills: string[];
            tools: string[];
            metrics: string[];
            actions: string[];
        };
        origin: "extracted" | "attested" | "edited";
        confidence?: number | undefined;
    }[];
    confidence?: number | undefined;
}, {
    end: string;
    id: string;
    company: string;
    title: string;
    start: string;
    bullets: {
        id: string;
        text: string;
        entities: {
            skills: string[];
            tools: string[];
            metrics: string[];
            actions: string[];
        };
        confidence?: number | undefined;
        origin?: "extracted" | "attested" | "edited" | undefined;
    }[];
    confidence?: number | undefined;
    origin?: "extracted" | "attested" | "edited" | undefined;
}>;
export declare const SkillSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    proficiency_stated: z.ZodEnum<["advanced", "intermediate", "beginner", "none"]>;
    confidence: z.ZodOptional<z.ZodNumber>;
    origin: z.ZodDefault<z.ZodEnum<["extracted", "attested", "edited"]>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    origin: "extracted" | "attested" | "edited";
    proficiency_stated: "advanced" | "intermediate" | "beginner" | "none";
    confidence?: number | undefined;
}, {
    id: string;
    name: string;
    proficiency_stated: "advanced" | "intermediate" | "beginner" | "none";
    confidence?: number | undefined;
    origin?: "extracted" | "attested" | "edited" | undefined;
}>;
export declare const ProjectSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    bullets: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        text: z.ZodString;
        entities: z.ZodObject<{
            skills: z.ZodArray<z.ZodString, "many">;
            tools: z.ZodArray<z.ZodString, "many">;
            metrics: z.ZodArray<z.ZodString, "many">;
            actions: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            skills: string[];
            tools: string[];
            metrics: string[];
            actions: string[];
        }, {
            skills: string[];
            tools: string[];
            metrics: string[];
            actions: string[];
        }>;
        confidence: z.ZodOptional<z.ZodNumber>;
        origin: z.ZodDefault<z.ZodEnum<["extracted", "attested", "edited"]>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        text: string;
        entities: {
            skills: string[];
            tools: string[];
            metrics: string[];
            actions: string[];
        };
        origin: "extracted" | "attested" | "edited";
        confidence?: number | undefined;
    }, {
        id: string;
        text: string;
        entities: {
            skills: string[];
            tools: string[];
            metrics: string[];
            actions: string[];
        };
        confidence?: number | undefined;
        origin?: "extracted" | "attested" | "edited" | undefined;
    }>, "many">;
    confidence: z.ZodOptional<z.ZodNumber>;
    origin: z.ZodDefault<z.ZodEnum<["extracted", "attested", "edited"]>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    origin: "extracted" | "attested" | "edited";
    bullets: {
        id: string;
        text: string;
        entities: {
            skills: string[];
            tools: string[];
            metrics: string[];
            actions: string[];
        };
        origin: "extracted" | "attested" | "edited";
        confidence?: number | undefined;
    }[];
    confidence?: number | undefined;
    description?: string | undefined;
}, {
    id: string;
    name: string;
    bullets: {
        id: string;
        text: string;
        entities: {
            skills: string[];
            tools: string[];
            metrics: string[];
            actions: string[];
        };
        confidence?: number | undefined;
        origin?: "extracted" | "attested" | "edited" | undefined;
    }[];
    confidence?: number | undefined;
    origin?: "extracted" | "attested" | "edited" | undefined;
    description?: string | undefined;
}>;
export declare const EducationSchema: z.ZodObject<{
    id: z.ZodString;
    institution: z.ZodString;
    degree: z.ZodString;
    field: z.ZodOptional<z.ZodString>;
    start: z.ZodOptional<z.ZodString>;
    end: z.ZodOptional<z.ZodString>;
    confidence: z.ZodOptional<z.ZodNumber>;
    origin: z.ZodDefault<z.ZodEnum<["extracted", "attested", "edited"]>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    origin: "extracted" | "attested" | "edited";
    institution: string;
    degree: string;
    end?: string | undefined;
    confidence?: number | undefined;
    start?: string | undefined;
    field?: string | undefined;
}, {
    id: string;
    institution: string;
    degree: string;
    end?: string | undefined;
    confidence?: number | undefined;
    origin?: "extracted" | "attested" | "edited" | undefined;
    start?: string | undefined;
    field?: string | undefined;
}>;
export declare const CertificationSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    issuer: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<["completed", "in_progress", "expired"]>;
    date: z.ZodOptional<z.ZodString>;
    confidence: z.ZodOptional<z.ZodNumber>;
    origin: z.ZodDefault<z.ZodEnum<["extracted", "attested", "edited"]>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    status: "completed" | "in_progress" | "expired";
    origin: "extracted" | "attested" | "edited";
    date?: string | undefined;
    confidence?: number | undefined;
    issuer?: string | undefined;
}, {
    id: string;
    name: string;
    status: "completed" | "in_progress" | "expired";
    date?: string | undefined;
    confidence?: number | undefined;
    origin?: "extracted" | "attested" | "edited" | undefined;
    issuer?: string | undefined;
}>;
export declare const ContactSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    links: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    links: string[];
    email?: string | undefined;
    phone?: string | undefined;
}, {
    name: string;
    email?: string | undefined;
    phone?: string | undefined;
    links?: string[] | undefined;
}>;
export declare const CandidateInventorySchema: z.ZodObject<{
    contact: z.ZodObject<{
        name: z.ZodString;
        email: z.ZodOptional<z.ZodString>;
        phone: z.ZodOptional<z.ZodString>;
        links: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        links: string[];
        email?: string | undefined;
        phone?: string | undefined;
    }, {
        name: string;
        email?: string | undefined;
        phone?: string | undefined;
        links?: string[] | undefined;
    }>;
    summary_raw: z.ZodOptional<z.ZodString>;
    experiences: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        company: z.ZodString;
        title: z.ZodString;
        start: z.ZodString;
        end: z.ZodString;
        bullets: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            text: z.ZodString;
            entities: z.ZodObject<{
                skills: z.ZodArray<z.ZodString, "many">;
                tools: z.ZodArray<z.ZodString, "many">;
                metrics: z.ZodArray<z.ZodString, "many">;
                actions: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                skills: string[];
                tools: string[];
                metrics: string[];
                actions: string[];
            }, {
                skills: string[];
                tools: string[];
                metrics: string[];
                actions: string[];
            }>;
            confidence: z.ZodOptional<z.ZodNumber>;
            origin: z.ZodDefault<z.ZodEnum<["extracted", "attested", "edited"]>>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            text: string;
            entities: {
                skills: string[];
                tools: string[];
                metrics: string[];
                actions: string[];
            };
            origin: "extracted" | "attested" | "edited";
            confidence?: number | undefined;
        }, {
            id: string;
            text: string;
            entities: {
                skills: string[];
                tools: string[];
                metrics: string[];
                actions: string[];
            };
            confidence?: number | undefined;
            origin?: "extracted" | "attested" | "edited" | undefined;
        }>, "many">;
        confidence: z.ZodOptional<z.ZodNumber>;
        origin: z.ZodDefault<z.ZodEnum<["extracted", "attested", "edited"]>>;
    }, "strip", z.ZodTypeAny, {
        end: string;
        id: string;
        origin: "extracted" | "attested" | "edited";
        company: string;
        title: string;
        start: string;
        bullets: {
            id: string;
            text: string;
            entities: {
                skills: string[];
                tools: string[];
                metrics: string[];
                actions: string[];
            };
            origin: "extracted" | "attested" | "edited";
            confidence?: number | undefined;
        }[];
        confidence?: number | undefined;
    }, {
        end: string;
        id: string;
        company: string;
        title: string;
        start: string;
        bullets: {
            id: string;
            text: string;
            entities: {
                skills: string[];
                tools: string[];
                metrics: string[];
                actions: string[];
            };
            confidence?: number | undefined;
            origin?: "extracted" | "attested" | "edited" | undefined;
        }[];
        confidence?: number | undefined;
        origin?: "extracted" | "attested" | "edited" | undefined;
    }>, "many">;
    skills: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        proficiency_stated: z.ZodEnum<["advanced", "intermediate", "beginner", "none"]>;
        confidence: z.ZodOptional<z.ZodNumber>;
        origin: z.ZodDefault<z.ZodEnum<["extracted", "attested", "edited"]>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        origin: "extracted" | "attested" | "edited";
        proficiency_stated: "advanced" | "intermediate" | "beginner" | "none";
        confidence?: number | undefined;
    }, {
        id: string;
        name: string;
        proficiency_stated: "advanced" | "intermediate" | "beginner" | "none";
        confidence?: number | undefined;
        origin?: "extracted" | "attested" | "edited" | undefined;
    }>, "many">;
    projects: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        bullets: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            text: z.ZodString;
            entities: z.ZodObject<{
                skills: z.ZodArray<z.ZodString, "many">;
                tools: z.ZodArray<z.ZodString, "many">;
                metrics: z.ZodArray<z.ZodString, "many">;
                actions: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                skills: string[];
                tools: string[];
                metrics: string[];
                actions: string[];
            }, {
                skills: string[];
                tools: string[];
                metrics: string[];
                actions: string[];
            }>;
            confidence: z.ZodOptional<z.ZodNumber>;
            origin: z.ZodDefault<z.ZodEnum<["extracted", "attested", "edited"]>>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            text: string;
            entities: {
                skills: string[];
                tools: string[];
                metrics: string[];
                actions: string[];
            };
            origin: "extracted" | "attested" | "edited";
            confidence?: number | undefined;
        }, {
            id: string;
            text: string;
            entities: {
                skills: string[];
                tools: string[];
                metrics: string[];
                actions: string[];
            };
            confidence?: number | undefined;
            origin?: "extracted" | "attested" | "edited" | undefined;
        }>, "many">;
        confidence: z.ZodOptional<z.ZodNumber>;
        origin: z.ZodDefault<z.ZodEnum<["extracted", "attested", "edited"]>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        origin: "extracted" | "attested" | "edited";
        bullets: {
            id: string;
            text: string;
            entities: {
                skills: string[];
                tools: string[];
                metrics: string[];
                actions: string[];
            };
            origin: "extracted" | "attested" | "edited";
            confidence?: number | undefined;
        }[];
        confidence?: number | undefined;
        description?: string | undefined;
    }, {
        id: string;
        name: string;
        bullets: {
            id: string;
            text: string;
            entities: {
                skills: string[];
                tools: string[];
                metrics: string[];
                actions: string[];
            };
            confidence?: number | undefined;
            origin?: "extracted" | "attested" | "edited" | undefined;
        }[];
        confidence?: number | undefined;
        origin?: "extracted" | "attested" | "edited" | undefined;
        description?: string | undefined;
    }>, "many">;
    education: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        institution: z.ZodString;
        degree: z.ZodString;
        field: z.ZodOptional<z.ZodString>;
        start: z.ZodOptional<z.ZodString>;
        end: z.ZodOptional<z.ZodString>;
        confidence: z.ZodOptional<z.ZodNumber>;
        origin: z.ZodDefault<z.ZodEnum<["extracted", "attested", "edited"]>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        origin: "extracted" | "attested" | "edited";
        institution: string;
        degree: string;
        end?: string | undefined;
        confidence?: number | undefined;
        start?: string | undefined;
        field?: string | undefined;
    }, {
        id: string;
        institution: string;
        degree: string;
        end?: string | undefined;
        confidence?: number | undefined;
        origin?: "extracted" | "attested" | "edited" | undefined;
        start?: string | undefined;
        field?: string | undefined;
    }>, "many">;
    certifications: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        issuer: z.ZodOptional<z.ZodString>;
        status: z.ZodEnum<["completed", "in_progress", "expired"]>;
        date: z.ZodOptional<z.ZodString>;
        confidence: z.ZodOptional<z.ZodNumber>;
        origin: z.ZodDefault<z.ZodEnum<["extracted", "attested", "edited"]>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        status: "completed" | "in_progress" | "expired";
        origin: "extracted" | "attested" | "edited";
        date?: string | undefined;
        confidence?: number | undefined;
        issuer?: string | undefined;
    }, {
        id: string;
        name: string;
        status: "completed" | "in_progress" | "expired";
        date?: string | undefined;
        confidence?: number | undefined;
        origin?: "extracted" | "attested" | "edited" | undefined;
        issuer?: string | undefined;
    }>, "many">;
    confirmed: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    skills: {
        id: string;
        name: string;
        origin: "extracted" | "attested" | "edited";
        proficiency_stated: "advanced" | "intermediate" | "beginner" | "none";
        confidence?: number | undefined;
    }[];
    contact: {
        name: string;
        links: string[];
        email?: string | undefined;
        phone?: string | undefined;
    };
    experiences: {
        end: string;
        id: string;
        origin: "extracted" | "attested" | "edited";
        company: string;
        title: string;
        start: string;
        bullets: {
            id: string;
            text: string;
            entities: {
                skills: string[];
                tools: string[];
                metrics: string[];
                actions: string[];
            };
            origin: "extracted" | "attested" | "edited";
            confidence?: number | undefined;
        }[];
        confidence?: number | undefined;
    }[];
    projects: {
        id: string;
        name: string;
        origin: "extracted" | "attested" | "edited";
        bullets: {
            id: string;
            text: string;
            entities: {
                skills: string[];
                tools: string[];
                metrics: string[];
                actions: string[];
            };
            origin: "extracted" | "attested" | "edited";
            confidence?: number | undefined;
        }[];
        confidence?: number | undefined;
        description?: string | undefined;
    }[];
    education: {
        id: string;
        origin: "extracted" | "attested" | "edited";
        institution: string;
        degree: string;
        end?: string | undefined;
        confidence?: number | undefined;
        start?: string | undefined;
        field?: string | undefined;
    }[];
    certifications: {
        id: string;
        name: string;
        status: "completed" | "in_progress" | "expired";
        origin: "extracted" | "attested" | "edited";
        date?: string | undefined;
        confidence?: number | undefined;
        issuer?: string | undefined;
    }[];
    confirmed: boolean;
    summary_raw?: string | undefined;
}, {
    skills: {
        id: string;
        name: string;
        proficiency_stated: "advanced" | "intermediate" | "beginner" | "none";
        confidence?: number | undefined;
        origin?: "extracted" | "attested" | "edited" | undefined;
    }[];
    contact: {
        name: string;
        email?: string | undefined;
        phone?: string | undefined;
        links?: string[] | undefined;
    };
    experiences: {
        end: string;
        id: string;
        company: string;
        title: string;
        start: string;
        bullets: {
            id: string;
            text: string;
            entities: {
                skills: string[];
                tools: string[];
                metrics: string[];
                actions: string[];
            };
            confidence?: number | undefined;
            origin?: "extracted" | "attested" | "edited" | undefined;
        }[];
        confidence?: number | undefined;
        origin?: "extracted" | "attested" | "edited" | undefined;
    }[];
    projects: {
        id: string;
        name: string;
        bullets: {
            id: string;
            text: string;
            entities: {
                skills: string[];
                tools: string[];
                metrics: string[];
                actions: string[];
            };
            confidence?: number | undefined;
            origin?: "extracted" | "attested" | "edited" | undefined;
        }[];
        confidence?: number | undefined;
        origin?: "extracted" | "attested" | "edited" | undefined;
        description?: string | undefined;
    }[];
    education: {
        id: string;
        institution: string;
        degree: string;
        end?: string | undefined;
        confidence?: number | undefined;
        origin?: "extracted" | "attested" | "edited" | undefined;
        start?: string | undefined;
        field?: string | undefined;
    }[];
    certifications: {
        id: string;
        name: string;
        status: "completed" | "in_progress" | "expired";
        date?: string | undefined;
        confidence?: number | undefined;
        origin?: "extracted" | "attested" | "edited" | undefined;
        issuer?: string | undefined;
    }[];
    summary_raw?: string | undefined;
    confirmed?: boolean | undefined;
}>;
export type ItemOrigin = z.infer<typeof ItemOrigin>;
export type Bullet = z.infer<typeof BulletSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Certification = z.infer<typeof CertificationSchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type CandidateInventory = z.infer<typeof CandidateInventorySchema>;
export {};
