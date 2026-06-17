import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, Subject } from 'rxjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Client as QStashClient } from '@upstash/qstash';
import { createId } from '@paralleldrive/cuid2';
import { PrismaService } from '../prisma/prisma.service';
import { AttachJobDto } from './dto/attach-job.dto';
import { PatchInventoryDto } from './dto/patch-inventory.dto';
import { PatchDecisionsDto } from './dto/patch-decisions.dto';
import { ExportDto } from './dto/export.dto';
import type { CandidateInventory, Skill } from '@applya/repositioner-core';
import { Renderer, CandidateInventorySchema, RepositionPlanSchema } from '@applya/repositioner-core';
import type { TemplateId } from '@applya/repositioner-core';

const STORAGE_BUCKET = 'sessions';
const RETENTION_DAYS = 30;

const TEMPLATES = [
  { id: 'classic', name: 'Classic', description: 'Single-column, ATS-safest default', atsRisk: 'low' },
  { id: 'modern', name: 'Modern', description: 'Single-column with accent heading style', atsRisk: 'low' },
  { id: 'compact', name: 'Compact', description: 'Denser single-column for longer CVs', atsRisk: 'low' },
];

@Injectable()
export class SessionsService {
  private readonly supabase: SupabaseClient;
  private readonly qstash: QStashClient;
  private readonly baseUrl: string;
  private readonly statusStreams = new Map<string, Subject<MessageEvent>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.supabase = createClient(
      config.getOrThrow('SUPABASE_URL'),
      config.getOrThrow('SUPABASE_SERVICE_KEY'),
    );
    this.qstash = new QStashClient({ token: config.getOrThrow('QSTASH_TOKEN') });
    this.baseUrl = config.getOrThrow('BASE_URL');
  }

  // ── Session creation ──────────────────────────────────────────────────────

  async create(file: Express.Multer.File, userId?: string) {
    if (!file) throw new BadRequestException('Resume file is required');

    // For the pilot, if no userId is provided, use a default "pilot" user
    if (!userId) {
      const pilotUser = await this.prisma.user.upsert({
        where: { email: 'pilot@applya.local' },
        update: {},
        create: { email: 'pilot@applya.local' },
      });
      userId = pilotUser.id;
    }

    const ext = file.mimetype.includes('pdf') ? 'pdf' : 'docx';
    const fileKey = `${createId()}/resume.${ext}`;

    const { error: uploadError } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileKey, file.buffer, { contentType: file.mimetype });

    if (uploadError) throw new BadRequestException(`Storage upload failed: ${uploadError.message}`);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + RETENTION_DAYS);

    const session = await this.prisma.session.create({
      data: {
        userId,
        resumeFileKey: fileKey,
        resumeMimeType: file.mimetype,
        status: 'PARSING',
        expiresAt,
      },
    });

    await this.enqueueInternal('phase-a', session.id);

    return { sessionId: session.id, status: 'PARSING' };
  }

  // ── Job description ───────────────────────────────────────────────────────

  async attachJob(id: string, dto: AttachJobDto) {
    await this.assertExists(id);
    await this.prisma.session.update({
      where: { id },
      data: { jobDescription: dto.jobDescription },
    });
    return { ok: true };
  }

  async enqueuePhaseA(id: string) {
    const session = await this.assertExists(id);
    if (session.inventoryConfirmed) {
      throw new ConflictException('Inventory already confirmed — cannot re-run Phase A');
    }
    await this.prisma.session.update({ where: { id }, data: { status: 'PARSING' } });
    await this.enqueueInternal('phase-a', id);
    return { ok: true };
  }

  // ── Session reads ─────────────────────────────────────────────────────────

  async findOne(id: string) {
    const session = await this.prisma.session.findUnique({ where: { id } });
    if (!session) throw new NotFoundException(`Session ${id} not found`);
    return session;
  }

  streamStatus(id: string): Observable<MessageEvent> {
    if (!this.statusStreams.has(id)) {
      this.statusStreams.set(id, new Subject<MessageEvent>());
    }
    return this.statusStreams.get(id)!.asObservable();
  }

  // ── Inventory review (Stage 2.5 human gate) ───────────────────────────────

  async getInventory(id: string) {
    const session = await this.assertExists(id);
    if (!session.inventory) throw new NotFoundException('Inventory not yet extracted');
    return { inventory: session.inventory, confirmed: session.inventoryConfirmed };
  }

  async patchInventory(id: string, dto: PatchInventoryDto) {
    const session = await this.assertExists(id);
    if (session.inventoryConfirmed) {
      throw new ConflictException('Inventory is already confirmed and frozen');
    }
    if (!session.inventory) throw new NotFoundException('Inventory not yet extracted');

    let inventory = session.inventory as unknown as CandidateInventory;

    // Apply field edits
    for (const edit of dto.edits ?? []) {
      inventory = applyInventoryEdit(inventory, edit.id, edit.field, edit.value);
    }

    // Apply attestations
    for (const att of dto.attestations ?? []) {
      if (att.category === 'skill' || att.category === 'tool') {
        const existing = inventory.skills.find(
          (s) => s.name.toLowerCase() === att.name.toLowerCase(),
        );
        if (!existing) {
          const newSkill: Skill = {
            id: `sk_att_${createId()}`,
            name: att.name,
            proficiency_stated: 'none',
            origin: 'attested',
            confidence: 1.0,
          };
          inventory = { ...inventory, skills: [...inventory.skills, newSkill] };
        } else if (existing.origin !== 'attested') {
          inventory = {
            ...inventory,
            skills: inventory.skills.map((s) =>
              s.id === existing.id ? { ...s, origin: 'attested' as const } : s,
            ),
          };
        }
      } else if (att.category === 'certification') {
        const existing = inventory.certifications.find(
          (c) => c.name.toLowerCase() === att.name.toLowerCase(),
        );
        if (!existing) {
          inventory = {
            ...inventory,
            certifications: [
              ...inventory.certifications,
              {
                id: `cert_att_${createId()}`,
                name: att.name,
                status: 'completed',
                origin: 'attested',
                confidence: 1.0,
              },
            ],
          };
        }
      }
    }

    await this.prisma.session.update({
      where: { id },
      data: { inventory: inventory as object },
    });

    return { inventory };
  }

  async confirmInventory(id: string) {
    const session = await this.assertExists(id);
    if (session.inventoryConfirmed) {
      throw new ConflictException('Inventory already confirmed');
    }
    if (!session.inventory) throw new NotFoundException('Inventory not yet extracted');
    if (!session.jobDescription) {
      throw new BadRequestException('Job description must be attached before confirming inventory');
    }

    await this.prisma.session.update({
      where: { id },
      data: { inventoryConfirmed: true, status: 'OPTIMISING' },
    });

    await this.enqueueInternal('phase-b', id);
    this.emitStatus(id, 'OPTIMISING');

    return { ok: true };
  }

  // ── Review decisions ──────────────────────────────────────────────────────

  async patchDecisions(id: string, dto: PatchDecisionsDto) {
    await this.assertExists(id);
    const decisions = dto.decisions.reduce<Record<string, unknown>>((acc, d) => {
      acc[d.sourceId] = { action: d.action, editedText: d.editedText };
      return acc;
    }, {});

    await this.prisma.session.update({
      where: { id },
      data: { userDecisions: decisions as object },
    });

    return { ok: true };
  }

  // ── Template gallery ──────────────────────────────────────────────────────

  async getTemplates(_id: string) {
    // Smart default: always 'classic' in MVP — Stage 8 can refine this
    return { templates: TEMPLATES, default: 'classic' };
  }

  // ── Export (render trigger) ───────────────────────────────────────────────

  async export(id: string, dto: ExportDto) {
    const session = await this.assertExists(id);
    if (session.status !== 'READY') {
      throw new BadRequestException('Session is not ready for export — pipeline must complete first');
    }
    if (!session.inventory || !session.repositionPlan) {
      throw new BadRequestException('Session is missing inventory or plan data');
    }

    const inventory = CandidateInventorySchema.parse(session.inventory);
    const plan = RepositionPlanSchema.parse(session.repositionPlan);
    const userDecisions = (session.userDecisions ?? {}) as Record<string, { action: 'accept' | 'reject' | 'edit'; editedText?: string }>;

    const renderer = new Renderer();
    const { docxBuffer, pdfBuffer } = await renderer.render({
      inventory,
      plan,
      decisions: userDecisions,
      templateId: dto.templateId as TemplateId,
    });

    const docxKey = `${id}/output-${dto.templateId}.docx`;
    const pdfKey = `${id}/output-${dto.templateId}.pdf`;

    await Promise.all([
      this.supabase.storage.from(STORAGE_BUCKET).upload(docxKey, docxBuffer, { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', upsert: true }),
      this.supabase.storage.from(STORAGE_BUCKET).upload(pdfKey, pdfBuffer, { contentType: 'application/pdf', upsert: true }),
    ]);

    await this.prisma.session.update({
      where: { id },
      data: { templateId: dto.templateId, outputDocxKey: docxKey, outputPdfKey: pdfKey },
    });

    return { ok: true, docxKey, pdfKey };
  }

  async getDownloadUrl(id: string, format: 'docx' | 'pdf') {
    const session = await this.assertExists(id);
    const key = format === 'docx' ? session.outputDocxKey : session.outputPdfKey;
    if (!key) throw new NotFoundException(`No ${format.toUpperCase()} output available yet`);

    const { data } = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(key, 60 * 60); // 1 hour

    if (!data) throw new NotFoundException('Could not generate download URL');
    return { url: data.signedUrl };
  }

  // ── POPIA wipe ────────────────────────────────────────────────────────────

  async remove(id: string) {
    const session = await this.assertExists(id);
    const keysToDelete = [
      session.resumeFileKey,
      session.outputDocxKey,
      session.outputPdfKey,
    ].filter(Boolean) as string[];

    if (keysToDelete.length > 0) {
      await this.supabase.storage.from(STORAGE_BUCKET).remove(keysToDelete);
    }

    await this.prisma.session.delete({ where: { id } });
    return { ok: true };
  }

  // ── SSE emit (called by InternalService after each stage) ─────────────────

  emitStatus(sessionId: string, status: string, data?: unknown) {
    const subject = this.statusStreams.get(sessionId);
    if (subject) {
      subject.next({ data: { status, ...((data as object) ?? {}) } } as unknown as MessageEvent);
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async assertExists(id: string) {
    const session = await this.prisma.session.findUnique({ where: { id } });
    if (!session) throw new NotFoundException(`Session ${id} not found`);
    return session;
  }

  private async enqueueInternal(phase: 'phase-a' | 'phase-b', sessionId: string) {
    const url = `${this.baseUrl}/internal/${phase}/${sessionId}`;

    if (process.env.NODE_ENV !== 'production') {
      // Dev: call our own endpoint directly — no QStash needed, no public URL required.
      // Fire-and-forget so the response to the client isn't blocked.
      // verifyQStashSignature already skips verification when signature is absent in dev.
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .catch((err: unknown) => console.error(`[dev] Failed to trigger ${phase} for ${sessionId}:`, err));
      return;
    }

    await this.qstash.publishJSON({ url, body: {} });
  }

}

// ── Inventory edit helper ─────────────────────────────────────────────────────

function applyInventoryEdit(
  inventory: CandidateInventory,
  itemId: string,
  field: string,
  value: unknown,
): CandidateInventory {
  // Skills section
  const skillIdx = inventory.skills.findIndex((s) => s.id === itemId);
  if (skillIdx !== -1) {
    const updated = [...inventory.skills];
    updated[skillIdx] = { ...updated[skillIdx], [field]: value, origin: 'edited' as const };
    return { ...inventory, skills: updated };
  }

  // Experience bullets
  const experiences = inventory.experiences.map((exp) => ({
    ...exp,
    bullets: exp.bullets.map((b) =>
      b.id === itemId ? { ...b, [field]: value, origin: 'edited' as const } : b,
    ),
    ...(exp.id === itemId ? { [field]: value, origin: 'edited' as const } : {}),
  }));

  // Project bullets
  const projects = inventory.projects.map((proj) => ({
    ...proj,
    bullets: proj.bullets.map((b) =>
      b.id === itemId ? { ...b, [field]: value, origin: 'edited' as const } : b,
    ),
  }));

  return { ...inventory, experiences, projects };
}
