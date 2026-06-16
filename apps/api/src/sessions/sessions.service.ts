import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { AttachJobDto } from './dto/attach-job.dto';
import { PatchInventoryDto } from './dto/patch-inventory.dto';
import { PatchDecisionsDto } from './dto/patch-decisions.dto';
import { ExportDto } from './dto/export.dto';

/**
 * SessionsService orchestrates the session lifecycle.
 * Each method is a thin delegation to:
 *   - Supabase (persistence)
 *   - Upstash QStash (job enqueueing)
 *   - @applya/repositioner-core (pipeline logic)
 *
 * TODO: inject PrismaService (@applya/database) and QStashClient once wired.
 */
@Injectable()
export class SessionsService {
  // SSE subjects keyed by session id
  private readonly statusStreams = new Map<string, Subject<MessageEvent>>();

  async create(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Resume file is required');
    // TODO:
    // 1. Upload file to Supabase Storage
    // 2. Create Session record (status: UPLOADED)
    // 3. Enqueue QStash message → POST /internal/phase-a/:id
    // 4. Return { sessionId, status: 'UPLOADED' }
    throw new Error('Not implemented');
  }

  async attachJob(id: string, dto: AttachJobDto) {
    // TODO: persist dto.jobDescription to session, update status if needed
    throw new Error('Not implemented');
  }

  async enqueuePhaseA(id: string) {
    // TODO: verify session exists, re-enqueue QStash Phase A message
    throw new Error('Not implemented');
  }

  async findOne(id: string) {
    // TODO: return session + all reports from Supabase
    throw new Error('Not implemented');
  }

  streamStatus(id: string): Observable<MessageEvent> {
    if (!this.statusStreams.has(id)) {
      this.statusStreams.set(id, new Subject<MessageEvent>());
    }
    return this.statusStreams.get(id)!.asObservable();
  }

  async getInventory(id: string) {
    // TODO: return session.inventory from Supabase
    throw new Error('Not implemented');
  }

  async patchInventory(id: string, dto: PatchInventoryDto) {
    // TODO: apply edits/attestations, tracking origin: edited | attested
    // Reject if inventoryConfirmed === true
    throw new Error('Not implemented');
  }

  async confirmInventory(id: string) {
    // TODO:
    // 1. Set inventoryConfirmed = true, status = OPTIMISING
    // 2. Enqueue QStash message → POST /internal/phase-b/:id
    // HARD GATE: Phase B must not run unless this is called
    throw new Error('Not implemented');
  }

  async patchDecisions(id: string, dto: PatchDecisionsDto) {
    // TODO: persist per-bullet accept/reject/edit decisions
    throw new Error('Not implemented');
  }

  async getTemplates(id: string) {
    // TODO: return template gallery with smart-default based on session's style signals
    throw new Error('Not implemented');
  }

  async export(id: string, dto: ExportDto) {
    // TODO: trigger Stage 8 render for templateId + format, store in Supabase Storage
    throw new Error('Not implemented');
  }

  async getDownloadUrl(id: string, format: 'docx' | 'pdf') {
    // TODO: return signed Supabase Storage URL
    throw new Error('Not implemented');
  }

  async remove(id: string) {
    // TODO: delete session + all storage objects (POPIA compliance)
    throw new Error('Not implemented');
  }

  /** Emit a status update to any active SSE subscribers for this session. */
  emitStatus(sessionId: string, status: string) {
    const subject = this.statusStreams.get(sessionId);
    if (subject) {
      subject.next({ data: { status } } as unknown as MessageEvent);
    }
  }
}
