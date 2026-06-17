import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  dbUserId: string;
}

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('No auth token provided');

    const supabase = createClient(
      this.config.getOrThrow('SUPABASE_URL'),
      this.config.getOrThrow('SUPABASE_SERVICE_KEY'),
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user?.email) throw new UnauthorizedException('Invalid or expired token');

    // Upsert user in our DB — creates on first login, no-ops on subsequent
    const dbUser = await this.prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: { email: user.email },
    });

    req.dbUserId = dbUser.id;
    return true;
  }

  private extractToken(req: Request): string | null {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) return auth.slice(7);
    return null;
  }
}
