import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from 'crypto';
import { promisify } from 'util';
import { badRequest, conflict, isPrismaKnownError, tooManyRequests, unauthorized } from '../../common';
import { authConfig } from '../../config/auth.config';
import { config } from '../../config';
import { DbClient, PrismaService } from '../../infrastructure/database/prisma.service';
import { SmsService } from './sms.service';

const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const scrypt = promisify(nodeScrypt);
const PASSWORD_KEY_LENGTH = 64;
const passwordHash = async (password: string) => {
  const salt = randomBytes(16).toString('base64url');
  const derived = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${derived.toString('base64url')}`;
};
const passwordMatches = async (password: string, stored: string | null) => {
  if (!stored) return false;
  const [algorithm, salt, encoded] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !encoded) return false;
  const expected = Buffer.from(encoded, 'base64url');
  const candidate = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
};
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const internationalPhonePattern = /^\+[1-9]\d{7,14}$/;
const normalizeIdentity = (value: string) => {
  const identity = value.trim();
  if (emailPattern.test(identity)) return { email: identity.toLowerCase() } as const;
  const compact = identity.replace(/[\s()-]/g, '');
  if (internationalPhonePattern.test(compact)) return { phone: compact } as const;
  const digits = compact.replace(/\D/g, '').replace(/^0098/, '').replace(/^98/, '').replace(/^0/, '');
  if (digits.length === 10) return { phone: `+98${digits}` } as const;
  throw badRequest('IDENTITY_INVALID');
};

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

  async loginWithPassword(identity: string, password: string, meta: SessionMetadata) {
    const normalized = normalizeIdentity(identity);
    const user = await this.db.user.findFirst({ where: normalized });
    if (!user || !(await passwordMatches(password, user.passwordHash))) throw unauthorized('INVALID_CREDENTIALS');
    return this.createSession(user.id, meta);
  }

  async registerWithPassword(name: string, identity: string, password: string, meta: SessionMetadata) {
    const normalized = normalizeIdentity(identity);
    if (await this.db.user.findFirst({ where: normalized })) throw conflict('IDENTITY_ALREADY_REGISTERED');
    const hashed = await passwordHash(password);
    try {
      const user = await this.db.user.create({
        data: {
          ...normalized,
          name: name.trim(),
          passwordHash: hashed,
          profileComplete: true,
          roles: { create: { role: 'STUDENT' } },
        },
      });
      return this.createSession(user.id, meta);
    } catch (error) {
      if (isPrismaKnownError(error) && error.code === 'P2002') throw conflict('IDENTITY_ALREADY_REGISTERED');
      throw error;
    }
  }

  async setPassword(userId: string, password: string) {
    await this.db.user.update({ where: { id: userId }, data: { passwordHash: await passwordHash(password) } });
    return { ok: true };
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

    // Claiming the challenge and checking that it was still claimable are one
    // statement. Read-then-update let two requests carrying the same correct
    // code both see `verifiedAt: null` and both go on to mint a session, so a
    // single OTP could open two of them.
    //
    // The guards above are re-stated here rather than trusted from the read:
    // they cover every field another request can move underneath us. `phone`
    // and `codeHash` are not among them — neither is ever updated — so
    // comparing those against the read row stays correct.
    const claimed = await this.db.otpChallenge.updateMany({
      where: {
        id: challenge.id,
        verifiedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: this.settings.otpAttemptLimit },
      },
      data: { verifiedAt: new Date() },
    });
    // Losing the claim means the challenge was verified, expired, or exhausted
    // by a concurrent request in the microseconds since the read. All three are
    // already indistinguishable to a caller from the checks above, so the loser
    // gets the same answer rather than a new code that would disclose the race.
    if (claimed.count !== 1) throw badRequest('OTP_INVALID_OR_EXPIRED');
    return this.createSession(challenge.userId, meta);
  }

  /**
   * Google's client is built once and kept, because the certificate cache it
   * verifies against lives on the instance — rebuilding it per sign-in would
   * turn a local check back into a network call every time.
   *
   * `transporterOptions.timeout` is the deadline on the one outbound call this
   * path can still make: the periodic certificate refresh. Without it a Google
   * endpoint that accepts the connection and then never answers holds the
   * request — and the worker serving it — open indefinitely.
   */
  private google?: OAuth2Client;
  private googleClient(clientId: string) {
    return (this.google ??= new OAuth2Client({
      clientId,
      transporterOptions: { timeout: this.settings.providerTimeoutMs },
    }));
  }

  /**
   * Verifies the credential locally against Google's published signing keys
   * instead of asking `oauth2.googleapis.com/tokeninfo` on every sign-in.
   *
   * Two problems with the call it replaces. The credential travelled in the
   * query string, so a Google ID token — a bearer credential for that account —
   * was written into access logs, tracing spans, and every proxy in between.
   * And it had no deadline at all.
   *
   * `verifyIdToken` checks the signature, `aud` (against our client id), `iss`
   * (Google's two accepted issuers) and `exp` in-process, so the common path
   * makes no outbound request whatsoever. The remaining checks are the ones it
   * does not make for us: that the token identifies someone, and that the
   * address on it has actually been verified by Google.
   */
  async verifyGoogle(credential: string, meta: SessionMetadata) {
    const clientId = this.settings.googleClientId;
    if (!clientId) throw badRequest('GOOGLE_AUTH_NOT_CONFIGURED');

    let profile: TokenPayload | undefined;
    try {
      const ticket = await this.googleClient(clientId).verifyIdToken({ idToken: credential, audience: clientId });
      profile = ticket.getPayload();
    } catch {
      // A malformed token, a bad signature, an expired token and an unreachable
      // certificate endpoint are all the same answer to the caller: this
      // credential did not establish who they are.
      throw unauthorized('GOOGLE_TOKEN_INVALID');
    }
    if (!profile?.sub || profile.email_verified !== true || !profile.email) {
      throw unauthorized('GOOGLE_TOKEN_INVALID');
    }

    const email = profile.email.toLowerCase();
    const existing = await this.db.user.findFirst({
      where: { OR: [{ googleSubject: profile.sub }, { email: { equals: email, mode: 'insensitive' } }] },
    });
    if (existing?.googleSubject && existing.googleSubject !== profile.sub) throw unauthorized('GOOGLE_TOKEN_INVALID');
    const user = existing
      ? await this.db.user.update({
          where: { id: existing.id },
          data: { googleSubject: profile.sub, email, name: profile.name },
        })
      : await this.db.user.create({
          data: { googleSubject: profile.sub, email, name: profile.name, roles: { create: { role: 'STUDENT' } } },
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
