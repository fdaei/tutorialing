import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PUBLIC_KEY } from '../constants/auth.constants';
import { AuthUser } from '../types/authenticated-user.type';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { unauthorized } from '../errors';
import { assertDomain, requireValue } from '../utils';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwt: JwtService,
    private db: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()])) {
      return true;
    }
    const req = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    assertDomain(token, () => unauthorized('AUTHENTICATION_REQUIRED'));
    try {
      const claims = await this.jwt.verifyAsync<AuthUser>(token);
      const session = requireValue(
        await this.db.refreshSession.findFirst({
          where: {
            id: claims.sessionId,
            userId: claims.id,
            revokedAt: null,
            expiresAt: { gt: new Date() },
            user: { status: 'ACTIVE' },
          },
          include: { user: { include: { roles: { include: { permissions: { include: { permission: true } } } } } } },
        }),
        () => unauthorized('SESSION_UNAVAILABLE'),
      );
      req.user = {
        id: session.user.id,
        sessionId: session.id,
        roles: session.user.roles.map((item) => item.role),
        permissions: [
          ...new Set(session.user.roles.flatMap((item) => item.permissions.map((entry) => entry.permission.key))),
        ],
      };
      return true;
    } catch {
      throw unauthorized('ACCESS_TOKEN_INVALID');
    }
  }
}
