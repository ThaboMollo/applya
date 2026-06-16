import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  Sse,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Observable } from 'rxjs';
import { SessionsService } from './sessions.service';
import { AttachJobDto } from './dto/attach-job.dto';
import { PatchInventoryDto } from './dto/patch-inventory.dto';
import { PatchDecisionsDto } from './dto/patch-decisions.dto';
import { ExportDto } from './dto/export.dto';

/**
 * REST surface for the Applya session lifecycle.
 * Full route contract is defined in the spec §8.
 *
 * Auth guard (Supabase JWT) is TODO — wire in once Supabase Auth is configured.
 */
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  /** POST /sessions — upload resume, create session, enqueue Phase A */
  @Post()
  @UseInterceptors(FileInterceptor('resume'))
  create(@UploadedFile() file: Express.Multer.File) {
    return this.sessions.create(file);
  }

  /** POST /sessions/:id/job — attach JD text */
  @Post(':id/job')
  attachJob(@Param('id') id: string, @Body() dto: AttachJobDto) {
    return this.sessions.attachJob(id, dto);
  }

  /** POST /sessions/:id/parse — (re-)enqueue Phase A */
  @Post(':id/parse')
  enqueuePhaseA(@Param('id') id: string) {
    return this.sessions.enqueuePhaseA(id);
  }

  /** GET /sessions/:id — status + all reports */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sessions.findOne(id);
  }

  /** GET /sessions/:id/stream — SSE status stream */
  @Sse(':id/stream')
  stream(@Param('id') id: string): Observable<MessageEvent> {
    return this.sessions.streamStatus(id);
  }

  /** GET /sessions/:id/inventory — extracted inventory for review */
  @Get(':id/inventory')
  getInventory(@Param('id') id: string) {
    return this.sessions.getInventory(id);
  }

  /** PATCH /sessions/:id/inventory — edit / attest items */
  @Patch(':id/inventory')
  patchInventory(@Param('id') id: string, @Body() dto: PatchInventoryDto) {
    return this.sessions.patchInventory(id, dto);
  }

  /** POST /sessions/:id/inventory/confirm — freeze inventory, enqueue Phase B */
  @Post(':id/inventory/confirm')
  confirmInventory(@Param('id') id: string) {
    return this.sessions.confirmInventory(id);
  }

  /** PATCH /sessions/:id/decisions — accept / reject / edit per-unit changes */
  @Patch(':id/decisions')
  patchDecisions(@Param('id') id: string, @Body() dto: PatchDecisionsDto) {
    return this.sessions.patchDecisions(id, dto);
  }

  /** GET /sessions/:id/templates — available templates + smart default */
  @Get(':id/templates')
  getTemplates(@Param('id') id: string) {
    return this.sessions.getTemplates(id);
  }

  /** POST /sessions/:id/export — trigger render */
  @Post(':id/export')
  export(@Param('id') id: string, @Body() dto: ExportDto) {
    return this.sessions.export(id, dto);
  }

  /** GET /sessions/:id/download/:format — signed download URL */
  @Get(':id/download/:format')
  download(@Param('id') id: string, @Param('format') format: 'docx' | 'pdf') {
    return this.sessions.getDownloadUrl(id, format);
  }

  /** DELETE /sessions/:id — POPIA user-initiated wipe */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sessions.remove(id);
  }
}
