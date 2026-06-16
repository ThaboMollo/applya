import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * InternalService drives both pipeline phases by calling
 * @applya/repositioner-core stage functions in sequence.
 *
 * Each stage persists its output to Supabase before calling the next,
 * so any stage can be re-run independently.
 *
 * TODO: inject PrismaService and all repositioner-core stage runners.
 */
@Injectable()
export class InternalService {
  constructor(private readonly config: ConfigService) {}

  verifyQStashSignature(signature: string) {
    // TODO: verify using @upstash/qstash Receiver
    // https://upstash.com/docs/qstash/sdks/ts/receivers
    if (!signature) throw new UnauthorizedException('Missing QStash signature');
  }

  async runPhaseA(sessionId: string) {
    // TODO — implement in order:
    // 1. Fetch session + file from Supabase (assert status === UPLOADED)
    // 2. Update status → PARSING
    // 3. Stage 1: call DoclingClient.parse(fileBytes) → DoclingDocument
    //    MVP shortcut: use mammoth (DOCX) / pdf-parse (PDF) behind the same interface
    // 4. Stage 2: call Extractor.extract(doclingDoc) → CandidateInventory
    //    - Uses Gemini Flash with strict JSON / Zod validation
    //    - Assigns stable IDs, tags confidence
    //    - PII must be redacted before the Gemini call (re-attach at render)
    // 5. Persist inventory to session, update status → INVENTORY_REVIEW
    // 6. Emit SSE status update
    throw new Error('Phase A not implemented');
  }

  async runPhaseB(sessionId: string) {
    // TODO — implement in order:
    // 0. Fetch session; assert inventoryConfirmed === true (HARD GATE)
    // 3. Stage 3: JobModelParser.parse(jobDescription) → JobModel
    // 4. Stage 4: Matcher.match(inventory, jobModel) → MatchReport
    //    - deterministic first (exact/fuzzy/synonym/implication), LLM only for ambiguous
    //    - classifies each JD requirement: covered | latent | gap
    // 5. Stage 5: Rephraser.reposition(inventory, jobModel, matchReport) → RepositionPlan
    //    - every emitted unit carries source_id + change_type
    //    - PII redacted before Gemini call
    // 6. Stage 6: Validator.validate(repositionPlan, inventory) → IntegrityReport
    //    - deterministic TypeScript, fully unit-testable
    //    - flags invented skills/metrics/proficiency
    //    - failures → auto-strip or pass to Stage 7
    // 7. Stage 7: Verifier.verify(flaggedUnits) → re-run or revert
    //    - narrow Gemini call per reworded/flagged unit
    // 8. Stage 8: Renderer.render(acceptedPlan, template) → DOCX + PDF
    //    - upload to Supabase Storage, update session with keys
    // 9. Update status → READY, emit SSE update
    throw new Error('Phase B not implemented');
  }
}
