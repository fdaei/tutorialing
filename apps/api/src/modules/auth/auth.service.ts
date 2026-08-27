import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { badRequest, isPrismaKnownError, tooManyRequests, unauthorized } from '../../common';
import { authConfig } from '../../config/auth.config';
import { config } from '../../config';
import { DbClient, PrismaService } from '../../infrastructure/database/prisma.service';
import { SmsService } from './sms.service';

const hash = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * Constant-time equality for secret material (hash digests, OTP codes). A
 * plain `!==`/`===` comparison short-circuits at the first differing byte,
 * leaking timing information proportional to how much of the two values
 * match. `timingSafeEqual` requires equal-length buffers and throws
 * otherwise, so a length mismatch is treated as unequal up front rather than
 * letting that throw escape as an unhandled error. (SEC-209)
 */
const constantTimeEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
};

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
      const retryAfterSeconds = Math.max(1, Math.ceil((recent.resendAfter.getTime() - now) / 1000));
      throw tooManyRequests('OTP_RESEND_TOO_SOON', retryAfterSeconds);
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
    if (!constantTimeEqual(challenge.codeHash, candidate)) {
      await this.db.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      throw badRequest('OTP_INCORRECT');
    }
    await this.db.otpChallenge.update({ where: { id: challenge.id }, data: { verifiedAt: new Date() } });
    return this.createSession(challenge.userId, meta);
  }

  async verifyGoogle(credential: string, meta: SessionMetadata) {
    if (!this.settings.googleClientId) throw badRequest('GOOGLE_AUTH_NOT_CONFIGURED');
    let response: Response;
    try {
      response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    } catch {
      throw unauthorized('GOOGLE_TOKEN_INVALID');
    }
    if (!response.ok) throw unauthorized('GOOGLE_TOKEN_INVALID');
    const profile = (await response.json()) as {
      sub?: string;
      aud?: string;
      iss?: string;
      email?: string;
      email_verified?: string;
      name?: string;
    };
    if (
      !profile.sub ||
      profile.aud !== this.settings.googleClientId ||
      !['accounts.google.com', 'https://accounts.google.com'].includes(profile.iss ?? '') ||
      profile.email_verified !== 'true' ||
      !profile.email
    )
      throw unauthorized('GOOGLE_TOKEN_INVALID');

    const user = await this.db.user.upsert({
      where: { googleSubject: profile.sub },
      update: { email: profile.email, name: profile.name },
      create: {
        googleSubject: profile.sub,
        email: profile.email,
        name: profile.name,
        roles: { create: { role: 'STUDENT' } },
      },
    });
    return this.createSession(user.id, meta);
  }

  private async createSession(
    userId: string,
    meta: SessionMetadata,
    familyId: string = randomUUID(),
    db: DbClient = this.db,
  ) {
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      include: { roles: { include: { permissions: { include: { permission: true } } } } },
    });
    if (user.status !== 'ACTIVE') throw unauthorized('ACCOUNT_UNAVAILABLE');
    const roles = user.roles.map((r) => r.role);
    const permissions = [...new Set(user.roles.flatMap((r) => r.permissions.map((p) => p.permission.key)))];
    const sessionId = randomUUID();
    const refreshSecret = randomBytes(32).toString('base64url');
    const refreshToken = `${sessionId}.${refreshSecret}`;
    await db.refreshSession.create({
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

  /**
   * Rotates a refresh token.
   *
   * Reading the session, minting its replacement, and revoking the original
   * used to be three separate statements against the live client, so two
   * requests carrying the same token could both pass the `revokedAt` check and
   * both go on to mint a session: one credential rotated twice, leaving two
   * live sessions where the whole point of rotation is that there is one.
   *
   * The revocation is now the claim. A single `updateMany` matches only a
   * session that is still unrevoked and unexpired, and only the caller whose
   * update actually moved a row goes on to create the replacement — all inside
   * one Serializable transaction, so the read the decision rests on cannot go
   * stale between the check and the write.
   *
   * Postgres aborts the losing writer with a serialization failure rather than
   * letting it observe a stale snapshot, so `count === 0` is not reachable at
   * this isolation level; it is the backstop that refuses to rotate anyway if
   * the isolation level is ever weakened (the same belt-and-braces shape as the
   * wallet balance re-read in `PaymentsService`).
   *
   * That abort is retried once, and by then the winner's revocation is visible,
   * so the loser falls into the reuse branch and is answered
   * `REFRESH_TOKEN_EXPIRED_OR_REUSED` — the honest description of two requests
   * spending one refresh token — rather than a bare serialization 409.
   */
  async refresh(token: string | undefined, meta: SessionMetadata) {
    if (!token) throw unauthorized('REFRESH_TOKEN_REQUIRED');
    const [id, secret] = token.split('.');
    if (!id || !secret) throw unauthorized('REFRESH_TOKEN_INVALID');

    // Reuse is reported out of the transaction rather than thrown from inside
    // it: revoking the family is the entire point of detecting reuse, and a
    // throw would roll that revocation back along with everything else.
    const rotate = () =>
      this.db.$transaction(
        async (tx) => {
          const session = await tx.refreshSession.findUnique({ where: { id } });
          if (
            !session ||
            session.revokedAt ||
            session.expiresAt < new Date() ||
            !constantTimeEqual(hash(secret), session.tokenHash)
          ) {
            return { rotated: null, reusedFamilyId: session?.familyId ?? null };
          }
          const claimed = await tx.refreshSession.updateMany({
            where: { id, revokedAt: null, expiresAt: { gt: new Date() } },
            data: { revokedAt: new Date() },
          });
          if (claimed.count !== 1) return { rotated: null, reusedFamilyId: session.familyId };
          const rotated = await this.createSession(session.userId, meta, session.familyId, tx);
          await tx.refreshSession.update({
            where: { id },
            data: { replacedById: rotated.refreshToken.split('.')[0] },
          });
          return { rotated, reusedFamilyId: null };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

    let outcome: Awaited<ReturnType<typeof rotate>>;
    try {
      outcome = await rotate();
    } catch (error) {
      if (!isPrismaKnownError(error) || error.code !== 'P2034') throw error;
      outcome = await rotate();
    }
    if (outcome.rotated) return outcome.rotated;
    if (outcome.reusedFamilyId) await this.revokeFamily(outcome.reusedFamilyId);
    throw unauthorized('REFRESH_TOKEN_EXPIRED_OR_REUSED');
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
