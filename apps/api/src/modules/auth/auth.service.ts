import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { badRequest, tooManyRequests, unauthorized } from '../../common';
import { authConfig } from '../../config/auth.config';
import { config } from '../../config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SmsService } from './sms.service';

const hash = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * A refresh secret is 32 random bytes, so a plain digest of it is not
 * precomputable. An OTP is one of 900,000 six-digit codes, and a plain SHA-256
 * of that space is a rainbow table anyone can build in seconds — so a leak of
 * `OtpChallenge` rows (a reporting export, a read-only replica) would hand over
 * every code still inside its two-minute window. Keying the digest with a
 * server-side secret makes the dump useless without it.
 *
 * The key is derived from `JWT_ACCESS_SECRET` rather than being its own env var
 * so there is nothing new to configure or rotate, and the derivation is
 * domain-separated so this is not the signing key itself. Challenges issued
 * before this shipped no longer verify; they expire two minutes later, so the
 * only effect is that a handful of in-flight users request a fresh code.
 */
let otpPepper: Buffer | undefined;
// Derived on first use, not at import: `config()` throws on an unvalidated
// environment, and this module is imported by unit tests that never boot one.
const pepper = () =>
  (otpPepper ??= createHmac('sha256', config().JWT_ACCESS_SECRET).update('lingospeak:otp-pepper:v1').digest());
const otpHash = (code: string) => createHmac('sha256', pepper()).update(code).digest('hex');

type SessionMetadata = { ip?: string; userAgent?: string };

@Injectable()
export class AuthService {
  private readonly settings = authConfig();

  constructor(
    private db: PrismaService,
    private jwt: JwtService,
    private sms: SmsService,
  ) {}

  async requestOtp(phone: string, _ip?: string) {
    const now = Date.now();
    const recent = await this.db.otpChallenge.findFirst({
      where: { phone, createdAt: { gte: new Date(now - this.settings.otpRecentRequestWindowSeconds * 1000) } },
      orderBy: { createdAt: 'desc' },
    });
    if (recent && recent.resendAfter > new Date()) {
      throw tooManyRequests('OTP_RESEND_TOO_SOON');
    }
    const hourlyRequestCount = await this.db.otpChallenge.count({
      where: { phone, createdAt: { gte: new Date(now - this.settings.otpHourlyWindowSeconds * 1000) } },
    });
    if (hourlyRequestCount >= this.settings.otpHourlyLimit) throw tooManyRequests('OTP_HOURLY_LIMIT');

    const code = this.settings.developmentOtp ? '123456' : String(randomInt(100000, 1000000));
    const user = await this.db.user.upsert({
      where: { phone },
      update: {},
      create: { phone, roles: { create: { role: 'STUDENT' } } },
    });
    const challenge = await this.db.otpChallenge.create({
      data: {
        phone,
        userId: user.id,
        codeHash: otpHash(code),
        expiresAt: new Date(now + this.settings.otpTtlSeconds * 1000),
        resendAfter: new Date(now + this.settings.otpResendSeconds * 1000),
      },
    });
    const sent = await this.sms.sendOtp(phone, code, user.id);
    return {
      challengeId: challenge.id,
      expiresIn: this.settings.otpTtlSeconds,
      resendIn: this.settings.otpResendSeconds,
      ...(sent.developmentCode && { developmentCode: sent.developmentCode }),
    };
  }

  async verifyOtp(challengeId: string, phone: string, code: string, meta: { ip?: string; userAgent?: string }) {
    const challenge = await this.db.otpChallenge.findUnique({ where: { id: challengeId } });
    if (
      !challenge ||
      !challenge.userId ||
      challenge.phone !== phone ||
      challenge.verifiedAt ||
      challenge.expiresAt < new Date()
    ) {
      throw badRequest('OTP_INVALID_OR_EXPIRED');
    }
    if (challenge.attempts >= this.settings.otpAttemptLimit) throw tooManyRequests('OTP_ATTEMPTS_EXCEEDED');

    const candidate = otpHash(code);
    const valid =
      challenge.codeHash.length === candidate.length &&
      timingSafeEqual(Buffer.from(challenge.codeHash), Buffer.from(candidate));
    if (!valid) {
      await this.db.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      throw badRequest('OTP_INCORRECT');
    }
    await this.db.otpChallenge.update({ where: { id: challenge.id }, data: { verifiedAt: new Date() } });
    return this.createSession(challenge.userId, meta);
  }

  private async createSession(userId: string, meta: SessionMetadata, familyId: string = randomUUID()) {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: userId },
      include: { roles: { include: { permissions: { include: { permission: true } } } } },
    });
    if (user.status !== 'ACTIVE') throw unauthorized('ACCOUNT_UNAVAILABLE');
    const roles = user.roles.map((r) => r.role);
    const permissions = [...new Set(user.roles.flatMap((r) => r.permissions.map((p) => p.permission.key)))];
    const sessionId = randomUUID();
    const refreshSecret = randomBytes(32).toString('base64url');
    const refreshToken = `${sessionId}.${refreshSecret}`;
    await this.db.refreshSession.create({
      data: {
        id: sessionId,
        userId,
        familyId,
        tokenHash: hash(refreshSecret),
        expiresAt: new Date(Date.now() + this.settings.refreshTokenTtlSeconds * 1000),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
    const accessToken = await this.jwt.signAsync({ id: user.id, roles, permissions, sessionId });
    return {
      accessToken,
      refreshToken,
      expiresIn: this.settings.accessTokenTtlSeconds,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        locale: user.locale,
        timezone: user.timezone,
        profileComplete: user.profileComplete,
        roles,
        permissions,
      },
    };
  }

  async refresh(token: string | undefined, meta: SessionMetadata) {
    if (!token) throw unauthorized('REFRESH_TOKEN_REQUIRED');
    const [id, secret] = token.split('.');
    if (!id || !secret) throw unauthorized('REFRESH_TOKEN_INVALID');
    const session = await this.db.refreshSession.findUnique({ where: { id } });
    if (!session || session.revokedAt || session.expiresAt < new Date() || hash(secret) !== session.tokenHash) {
      if (session) await this.revokeFamily(session.familyId);
      throw unauthorized('REFRESH_TOKEN_EXPIRED_OR_REUSED');
    }
    const next = await this.createSession(session.userId, meta, session.familyId);
    await this.db.refreshSession.update({
      where: { id },
      data: { revokedAt: new Date(), replacedById: next.refreshToken.split('.')[0] },
    });
    return next;
  }

  async logout(token: string) {
    const id = token.split('.')[0];
    if (id) await this.db.refreshSession.updateMany({ where: { id }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  revokeFamily(familyId: string) {
    return this.db.refreshSession.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
