import { Controller, Post, Param, Headers, UnauthorizedException } from '@nestjs/common';
import { InternalService } from './internal.service';

/**
 * QStash-triggered webhook handlers for the two pipeline phases.
 * Routes are prefixed /internal and must verify the QStash signature header
 * before processing. See: https://upstash.com/docs/qstash/features/security
 */
@Controller('internal')
export class InternalController {
  constructor(private readonly internal: InternalService) {}

  /** POST /internal/phase-a/:id — triggered by QStash; runs Stages 1 + 2 */
  @Post('phase-a/:id')
  async runPhaseA(
    @Param('id') id: string,
    @Headers('upstash-signature') signature: string,
  ) {
    this.internal.verifyQStashSignature(signature);
    return this.internal.runPhaseA(id);
  }

  /** POST /internal/phase-b/:id — triggered by QStash; runs Stages 3–8 */
  @Post('phase-b/:id')
  async runPhaseB(
    @Param('id') id: string,
    @Headers('upstash-signature') signature: string,
  ) {
    this.internal.verifyQStashSignature(signature);
    return this.internal.runPhaseB(id);
  }

  /**
   * POST /internal/cleanup — POPIA TTL: delete sessions past their expiresAt.
   * Triggered daily by QStash scheduled message or Vercel cron.
   * Schedule via QStash: set destination to POST {BASE_URL}/internal/cleanup, cron: "0 2 * * *"
   */
  @Post('cleanup')
  async cleanup(@Headers('upstash-signature') signature: string) {
    await this.internal.verifyQStashSignature(signature);
    return this.internal.runCleanup();
  }
}
