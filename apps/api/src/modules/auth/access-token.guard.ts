import { CanActivate, ExecutionContext, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PUBLIC_KEY } from '../../common/http/constants/auth.constants';
import { AuthUser } from '../../common/types/authenticated-user.type';
import { TokenRevocationService } from './token-revocation.service';

/**
 * Roles for which a revocation check is mandatory rather than best-effort.
 *
 * Verifying the JWT signature alone let a suspended or demoted user keep acting
 * on their old claims until the token expired. The revocation marker closes
 * that, but it lives in Redis, and making every authenticated request fail when
 * Redis blips would trade a 15-minute staleness window for a full API outage.
 * So the check fails closed only where the window actually matters — the roles
 * that can move money or change privileges — and fails open for ordinary
 * student/teacher traffic, which degrades to the previous behaviour.
 */
const PRIVILEGED_ROLES = ['ADMIN', 'FINANCE', 'STAFF', 'SUPPORT', 'EXAMINER'];

@Injectable()
export class AccessGuard implements CanActivate {
  private readonly log = new Logger(AccessGuard.name);

  constructor(private reflector: Reflector, private jwt: JwtService, private revocation: TokenRevocationService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()])) {
      return true;
    }
    const req = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new UnauthorizedException('Authentication required');
    let payload: AuthUser & { iat?: number };
    try {
      // Pin the algorithm. The signing key is symmetric, so an attacker cannot
      // forge an RS256 token and jsonwebtoken already refuses `alg: none` unless
      // it is explicitly allowed -- but leaving the allowlist open means any
      // future move to an asymmetric key silently reintroduces the confusion
      // attack. Cheaper to pin now than to remember later.
      payload = await this.jwt.verifyAsync<AuthUser & { iat?: number }>(token, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    await this.assertNotRevoked(payload);
    req.user = payload;
    return true;
  }

  private async assertNotRevoked(payload: AuthUser & { iat?: number }) {
    const privileged = payload.roles.some(role => PRIVILEGED_ROLES.includes(role));
    let revokedAt: number;
    try {
      revokedAt = await this.revocation.revokedAt(payload.id);
    } catch (error) {
      this.log.error(`Revocation check unavailable for user ${payload.id}`, error instanceof Error ? error.stack : String(error));
      if (privileged) throw new ServiceUnavailableException('Session verification unavailable');
      return;
    }
    // `<=` rather than `<`: `iat` has one-second resolution, so a token minted
    // in the same second as the revocation would otherwise slip through. The
    // cost is that a legitimate re-login landing in that same second is
    // rejected once and succeeds on the next attempt.
    if (revokedAt && (payload.iat ?? 0) <= revokedAt) {
      throw new UnauthorizedException('Session no longer valid');
    }
  }
}
