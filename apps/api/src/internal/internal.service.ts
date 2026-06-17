import { Injectable, UnauthorizedException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Receiver } from '@upstash/qstash';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';
import { SessionsService } from '../sessions/sessions.service';
import {
  MvpStubParser,
  DoclingClient,
  GeminiEngine,
  Validator,
  Renderer,
  CandidateInventorySchema,
} from '@applya/repositioner-core';

const STORAGE_BUCKET = 'sessions';

@Injectable()
export class InternalService {
  private readonly receiver: Receiver;
  private readonly supabase: SupabaseClient;
  private readonly parser: MvpStubParser | DoclingClient;
  private readonly gemini: GeminiEngine;
  private readonly renderer: Renderer;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
  ) {
    this.receiver = new Receiver({
      currentSigningKey: config.getOrThrow('QSTASH_CURRENT_SIGNING_KEY'),
      nextSigningKey: config.getOrThrow('QSTASH_NEXT_SIGNING_KEY'),
    });
    this.supabase = createClient(
      config.getOrThrow('SUPABASE_URL'),
      config.getOrThrow('SUPABASE_SERVICE_KEY'),
    );
    const doclingUrl = config.get<string>('DOCLING_SERVE_URL');
    this.parser = doclingUrl ? new DoclingClient(doclingUrl) : new MvpStubParser();
    this.gemini = new GeminiEngine(config.getOrThrow('GEMINI_API_KEY'));
    this.renderer = new Renderer();
  }

  async verifyQStashSignature(signature: string, body = '') {
    // Dev bypass — allows direct calls without QStash in local development
    if (process.env.NODE_ENV !== 'production' && !signature) return;
    if (!signature) throw new UnauthorizedException('Missing QStash signature');
    try {
      await this.receiver.verify({ signature, body });
    } catch {
      throw new UnauthorizedException('Invalid QStash signature');
    }
  }

  // ── POPIA cleanup ─────────────────────────────────────────────────────────────

  async runCleanup(): Promise<{ deleted: number }> {
    const expired = await this.prisma.session.findMany({
      where: { expiresAt: { lt: new Date() } },
      select: { id: true, resumeFileKey: true, outputDocxKey: true, outputPdfKey: true },
    });

    for (const session of expired) {
      const keys = [session.resumeFileKey, session.outputDocxKey, session.outputPdfKey]
        .filter((k): k is string => !!k);
      if (keys.length > 0) {
        await this.supabase.storage.from('sessions').remove(keys);
      }
      await this.prisma.session.delete({ where: { id: session.id } });
    }

    console.log(`[cleanup] Deleted ${expired.length} expired sessions`);
    return { deleted: expired.length };
  }

  // ── Phase A: parse → extract inventory ───────────────────────────────────

  async runPhaseA(sessionId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new BadRequestException(`Session ${sessionId} not found`);

    try {
      // Stage 1 — fetch file from Supabase Storage and parse
      this.sessions.emitStatus(sessionId, 'PARSING');

      const { data: fileData, error: fetchErr } = await this.supabase.storage
        .from(STORAGE_BUCKET)
        .download(session.resumeFileKey);

      if (fetchErr || !fileData) {
        throw new InternalServerErrorException(`Could not fetch resume file: ${fetchErr?.message}`);
      }

      const fileBuffer = Buffer.from(await fileData.arrayBuffer());
      const parsed = await this.parser.parse(fileBuffer, session.resumeMimeType);

      // Stage 2 — LLM inventory extraction
      this.sessions.emitStatus(sessionId, 'EXTRACTING');

      const inventory = await this.gemini.extractInventory(parsed.text);

      // Validate the schema before persisting
      const validatedInventory = CandidateInventorySchema.parse({ ...inventory, confirmed: false });

      await this.prisma.session.update({
        where: { id: sessionId },
        data: {
          inventory: validatedInventory as object,
          status: 'INVENTORY_REVIEW',
        },
      });

      this.sessions.emitStatus(sessionId, 'INVENTORY_REVIEW');
      return { ok: true, status: 'INVENTORY_REVIEW' };
    } catch (err) {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: {
          status: 'FAILED',
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
      this.sessions.emitStatus(sessionId, 'FAILED');
      throw err;
    }
  }

  // ── Phase B: JD model → match → reposition → validate → verify → render ─

  async runPhaseB(sessionId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new BadRequestException(`Session ${sessionId} not found`);

    // Hard gate — must not run without confirmed inventory
    if (!session.inventoryConfirmed) {
      throw new BadRequestException('Phase B requires inventoryConfirmed = true');
    }
    if (!session.jobDescription) {
      throw new BadRequestException('Phase B requires a job description');
    }

    try {
      const inventory = CandidateInventorySchema.parse(session.inventory);

      // Stage 3 — parse JD into structured model
      this.sessions.emitStatus(sessionId, 'ANALYSING_JD');
      const jobModel = await this.gemini.parseJobModel(session.jobDescription);

      // Stage 4 — deterministic match + gap analysis
      this.sessions.emitStatus(sessionId, 'MATCHING');
      const { matchReport, matchContext } = runMatchAnalysis(inventory, jobModel);

      // Stage 5 — re-positioning generation
      this.sessions.emitStatus(sessionId, 'REPOSITIONING');
      const repositionPlan = await this.gemini.repositionResume(inventory, jobModel, matchContext);

      // Stage 6 — programmatic validation
      this.sessions.emitStatus(sessionId, 'VALIDATING');
      const validator = new Validator(inventory);
      const integrityReport = validator.validatePlan(repositionPlan);

      // Stage 7 — LLM verifier for reworded bullets that passed Stage 6
      this.sessions.emitStatus(sessionId, 'VERIFYING');
      const verifiedPlan = await runVerification(repositionPlan, inventory, this.gemini);

      // Stage 8 — render DOCX + PDF with default template
      this.sessions.emitStatus(sessionId, 'RENDERING');
      const userDecisions = (session.userDecisions ?? {}) as Record<string, { action: 'accept' | 'reject' | 'edit'; editedText?: string }>;
      const { docxBuffer, pdfBuffer } = await this.renderer.render({
        inventory,
        plan: verifiedPlan,
        decisions: userDecisions,
        templateId: (session.templateId as 'classic' | 'modern' | 'compact') ?? 'classic',
      });

      const docxKey = `${sessionId}/output.docx`;
      const pdfKey = `${sessionId}/output.pdf`;

      await Promise.all([
        this.supabase.storage.from(STORAGE_BUCKET).upload(docxKey, docxBuffer, { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', upsert: true }),
        this.supabase.storage.from(STORAGE_BUCKET).upload(pdfKey, pdfBuffer, { contentType: 'application/pdf', upsert: true }),
      ]);

      await this.prisma.session.update({
        where: { id: sessionId },
        data: {
          jobModel: jobModel as object,
          matchReport: matchReport as object,
          repositionPlan: verifiedPlan as object,
          integrityReport: integrityReport as object,
          outputDocxKey: docxKey,
          outputPdfKey: pdfKey,
          status: 'READY',
        },
      });

      this.sessions.emitStatus(sessionId, 'READY');
      return { ok: true, status: 'READY' };
    } catch (err) {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: {
          status: 'FAILED',
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
      this.sessions.emitStatus(sessionId, 'FAILED');
      throw err;
    }
  }
}

// ── Stage 4 — deterministic match + gap analysis ──────────────────────────────

import {
  CandidateInventory,
  JobModel,
  MatchReport,
  buildSynonymLookup,
  resolveCanonical,
  getImpliedSkills,
  IMPLICATION_RULES,
} from '@applya/repositioner-core';

function runMatchAnalysis(
  inventory: CandidateInventory,
  jobModel: JobModel,
): { matchReport: MatchReport; matchContext: string } {
  const synonymLookup = buildSynonymLookup();

  // Build the full candidate entity set (same as Validator)
  const rawEntities = [
    ...inventory.skills.map((s) => s.name),
    ...inventory.experiences.flatMap((e) => e.bullets).flatMap((b) => [
      ...b.entities.skills,
      ...b.entities.tools,
    ]),
    ...inventory.projects.flatMap((p) => p.bullets).flatMap((b) => [
      ...b.entities.skills,
      ...b.entities.tools,
    ]),
  ];

  const canonicalEntities = new Set(
    rawEntities.map((n) => resolveCanonical(n, synonymLookup).toLowerCase()),
  );

  const skillSectionNames = new Set(
    inventory.skills.map((s) => resolveCanonical(s.name, synonymLookup).toLowerCase()),
  );

  const implied = getImpliedSkills(rawEntities, IMPLICATION_RULES);
  const impliedNames = new Set(implied.map((i) => i.implied.toLowerCase()));

  function classify(requirement: string) {
    const reqCanonical = resolveCanonical(requirement, synonymLookup).toLowerCase();

    if (skillSectionNames.has(reqCanonical)) {
      return { bucket: 'covered' as const, match_rule: 'exact' as const, source_ids: findSourceIds(inventory, reqCanonical, synonymLookup) };
    }
    if (canonicalEntities.has(reqCanonical)) {
      return { bucket: 'latent' as const, match_rule: 'exact' as const, source_ids: findSourceIds(inventory, reqCanonical, synonymLookup) };
    }
    if (impliedNames.has(reqCanonical)) {
      const rule = implied.find((i) => i.implied.toLowerCase() === reqCanonical);
      return { bucket: 'latent' as const, match_rule: 'implication' as const, source_ids: [], implication_antecedent: rule?.antecedent };
    }

    return { bucket: 'gap' as const, match_rule: 'none' as const, source_ids: [] };
  }

  const mustHaveCoverage = jobModel.must_have.map((req) => ({
    requirement: req,
    ...classify(req),
  }));

  const niceToHaveCoverage = jobModel.nice_to_have.map((req) => ({
    requirement: req,
    ...classify(req),
  }));

  const gaps = [
    ...mustHaveCoverage.filter((r) => r.bucket === 'gap').map((r) => r.requirement),
    ...niceToHaveCoverage.filter((r) => r.bucket === 'gap').map((r) => r.requirement),
  ];

  const totalReqs = mustHaveCoverage.length + niceToHaveCoverage.length * 0.5;
  const coveredReqs =
    mustHaveCoverage.filter((r) => r.bucket !== 'gap').length +
    niceToHaveCoverage.filter((r) => r.bucket !== 'gap').length * 0.5;

  const matchScore = totalReqs > 0 ? Math.round((coveredReqs / totalReqs) * 100) : 0;

  const matchReport: MatchReport = {
    must_have: mustHaveCoverage,
    nice_to_have: niceToHaveCoverage,
    match_score: matchScore,
    gaps,
  };

  const matchContext = `Match score: ${matchScore}%
Covered must-have: ${mustHaveCoverage.filter((r) => r.bucket !== 'gap').map((r) => r.requirement).join(', ')}
Latent (surface these): ${[...mustHaveCoverage, ...niceToHaveCoverage].filter((r) => r.bucket === 'latent').map((r) => r.requirement).join(', ')}
Honest gaps (do not inject): ${gaps.join(', ')}`;

  return { matchReport, matchContext };
}

function findSourceIds(
  inventory: CandidateInventory,
  reqCanonical: string,
  synonymLookup: Map<string, string>,
): string[] {
  const ids: string[] = [];
  for (const exp of inventory.experiences) {
    for (const bullet of exp.bullets) {
      const bulletEntities = [...bullet.entities.skills, ...bullet.entities.tools];
      if (bulletEntities.some((e) => resolveCanonical(e, synonymLookup).toLowerCase() === reqCanonical)) {
        ids.push(bullet.id);
      }
    }
  }
  for (const proj of inventory.projects) {
    for (const bullet of proj.bullets) {
      const bulletEntities = [...bullet.entities.skills, ...bullet.entities.tools];
      if (bulletEntities.some((e) => resolveCanonical(e, synonymLookup).toLowerCase() === reqCanonical)) {
        ids.push(bullet.id);
      }
    }
  }
  return ids;
}

// ── Stage 7 — LLM verification of reworded bullets ───────────────────────────

import { RepositionPlan, GeminiEngine as GeminiEngineType } from '@applya/repositioner-core';

// Stage 7 only runs on actually-changed bullets, sequentially to respect Gemini rate limits
async function runVerification(
  plan: RepositionPlan,
  inventory: CandidateInventory,
  gemini: GeminiEngineType,
): Promise<RepositionPlan> {
  const verifiedBullets: RepositionPlan['bullets'] = [];

  for (const bullet of plan.bullets) {
    // Skip bullets where nothing changed — no verification needed
    const isUnchanged = bullet.change_type === 'unchanged' || bullet.original === bullet.rewritten;
    if (isUnchanged) {
      verifiedBullets.push({ ...bullet, validated: true });
      continue;
    }

    const sourceText = findBulletText(inventory, bullet.source_id) ?? bullet.original;
    const { supported } = await gemini.verifyUnit(sourceText, bullet.rewritten);

    if (supported) {
      verifiedBullets.push({ ...bullet, validated: true });
    } else {
      // Revert to original — never let an unsupported claim through
      verifiedBullets.push({
        ...bullet,
        rewritten: bullet.original,
        change_type: 'unchanged' as const,
        rationale: 'Reverted — LLM judge found claim not fully supported by source',
        validated: true,
      });
    }
  }

  return { ...plan, bullets: verifiedBullets };
}

function findBulletText(inventory: CandidateInventory, sourceId: string): string | null {
  for (const exp of inventory.experiences) {
    const b = exp.bullets.find((b) => b.id === sourceId);
    if (b) return b.text;
  }
  for (const proj of inventory.projects) {
    const b = proj.bullets.find((b) => b.id === sourceId);
    if (b) return b.text;
  }
  return null;
}
