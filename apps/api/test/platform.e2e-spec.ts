import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
describe('LingoSpeak platform flows', () => {
  let app: INestApplication,
    db: PrismaService,
    jwt: JwtService,
    token: string,
    userId: string,
    adminToken: string,
    teacher: any,
    slot: any,
    test: any;
  // E.164, matching `IsInternationalPhone` on the OTP DTOs. This fixture was
  // still on the national `09...` form and every flow below it failed at the
  // first request as a result.
  const phone = `+989${String(Date.now()).slice(-9)}`;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    db = module.get(PrismaService);
    jwt = module.get(JwtService);
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
  });
  afterAll(() => app.close());
  it('authenticates with persisted OTP and protects the profile', async () => {
    await request(app.getHttpServer()).post('/api/auth/refresh').expect(401);
    const challenge = await request(app.getHttpServer()).post('/api/auth/otp/request').send({ phone }).expect(201);
    expect(challenge.body.developmentCode).toBe('123456');
    const verified = await request(app.getHttpServer())
      .post('/api/auth/otp/verify')
      .send({ phone, challengeId: challenge.body.challengeId, code: '123456' })
      .expect(201);
    token = verified.body.accessToken;
    userId = (await db.user.findUniqueOrThrow({ where: { phone } })).id;
    expect(token).toBeTruthy();
    await request(app.getHttpServer()).get('/api/users/me').set('authorization', `Bearer ${token}`).expect(200);
  });
  it('lists only approved teachers and persists best-three matching', async () => {
    const teachers = await request(app.getHttpServer()).get('/api/teachers?limit=3').expect(200);
    expect(teachers.body.data.length).toBeGreaterThan(0);
    expect(teachers.body.data.length).toBeLessThanOrEqual(3);
    teacher = teachers.body.data[0];
    const languageId = teacher.languageLinks[0].language.id;
    const match = await request(app.getHttpServer())
      .post('/api/matching')
      .set('authorization', `Bearer ${token}`)
      .send({
        languageId,
        currentLevel: 'B1',
        learningGoal: 'Improve communication',
        targetLevel: 'B2',
        targetBand: 7,
        weakSkills: ['writing'],
        budget: Math.max(500000, teacher.approvedTrialPrice ?? 0),
        suitableDays: [],
        preferredTime: 'evening',
        trialRequired: true,
        classType: 'private',
        availability: { periods: ['evening'] },
        timezone: 'Asia/Tehran',
      })
      .expect(201);
    expect(match.body.recommendations.length).toBeGreaterThan(0);
    expect(match.body.recommendations.length).toBeLessThanOrEqual(3);
  });
  it('prevents concurrent reservation of the same teacher slot', async () => {
    const from = new Date().toISOString(),
      to = new Date(Date.now() + 7 * 864e5).toISOString();
    const slots = await request(app.getHttpServer())
      .get(
        `/api/availability/${teacher.id}/slots?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&type=trial`,
      )
      .expect(200);
    expect(slots.body.length).toBeGreaterThan(0);
    slot = slots.body[0];
    const body = {
      teacherId: teacher.id,
      startsAt: slot.startsAt,
      type: 'trial',
      policyAccepted: true,
      timezone: 'Asia/Tehran',
    };
    const results = await Promise.all([
      request(app.getHttpServer()).post('/api/bookings').set('authorization', `Bearer ${token}`).send(body),
      request(app.getHttpServer()).post('/api/bookings').set('authorization', `Bearer ${token}`).send(body),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const booking = results.find((r) => r.status === 201)!.body;
    const key = `e2e-${Date.now()}`;
    const first = await request(app.getHttpServer())
      .post('/api/payments')
      .set('authorization', `Bearer ${token}`)
      .send({ purpose: 'booking', referenceId: booking.id, walletAmount: 0, idempotencyKey: key })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/api/payments')
      .set('authorization', `Bearer ${token}`)
      .send({ purpose: 'booking', referenceId: booking.id, walletAmount: 0, idempotencyKey: key })
      .expect(201);
    expect(second.body.id).toBe(first.body.id);
  });
  it('autosaves, locks all sections and submits a real placement attempt', async () => {
    const tests = await request(app.getHttpServer()).get('/api/tests').expect(200);
    test = tests.body[0];
    const started = await request(app.getHttpServer())
      .post('/api/tests/attempts')
      .set('authorization', `Bearer ${token}`)
      .send({ testId: test.id })
      .expect(201);
    const user = await db.user.findUniqueOrThrow({ where: { phone } });
    const audio = await db.storedFile.create({
      data: {
        ownerId: user.id,
        key: `e2e/${Date.now()}.webm`,
        originalName: 'answer.webm',
        mimeType: 'audio/webm',
        size: 32,
        checksum: 'a'.repeat(64),
        status: 'SAFE',
        purpose: 'speaking-answer',
      },
    });
    let attempt = (
      await request(app.getHttpServer())
        .get(`/api/tests/attempts/${started.body.id}`)
        .set('authorization', `Bearer ${token}`)
        .expect(200)
    ).body;
    for (const section of attempt.test.sections) {
      const answers = section.questions.map((question: any) =>
        question.type === 'single_choice'
          ? { questionId: question.id, value: 0, flagged: false }
          : question.type === 'recording'
            ? { questionId: question.id, fileId: audio.id, flagged: false }
            : {
                questionId: question.id,
                textValue:
                  'A complete development response with enough language for deterministic scoring and human review.',
                flagged: false,
              },
      );
      await request(app.getHttpServer())
        .patch(`/api/tests/attempts/${started.body.id}/answers`)
        .set('authorization', `Bearer ${token}`)
        .send({ answers })
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/tests/attempts/${started.body.id}/sections/${section.id}/submit`)
        .set('authorization', `Bearer ${token}`)
        .expect(201);
      attempt = (
        await request(app.getHttpServer())
          .get(`/api/tests/attempts/${started.body.id}`)
          .set('authorization', `Bearer ${token}`)
          .expect(200)
      ).body;
    }
    const submitted = await request(app.getHttpServer())
      .post(`/api/tests/attempts/${started.body.id}/submit`)
      .set('authorization', `Bearer ${token}`)
      .expect(201);
    expect(submitted.body.status).toBe('UNDER_REVIEW');
  });
  it('creates threaded support tickets', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/support/tickets')
      .set('authorization', `Bearer ${token}`)
      .send({
        subject: 'زمان کلاس آزمایشی',
        category: 'booking',
        priority: 'normal',
        body: 'برای تغییر زمان به راهنمایی نیاز دارم.',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/support/tickets/${created.body.id}/replies`)
      .set('authorization', `Bearer ${token}`)
      .send({ body: 'اطلاعات تکمیلی درخواست من' })
      .expect(201);
    const list = await request(app.getHttpServer())
      .get('/api/support/tickets')
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body.items.some((x: any) => x.id === created.body.id)).toBe(true);
  });
  it('exposes admin operations and rolls back wallet debits on failed gateway callbacks', async () => {
    const admin = await db.user.findUniqueOrThrow({
      where: { phone: '+989120000000' },
      include: { roles: { include: { permissions: { include: { permission: true } } } } },
    });
    adminToken = await jwt.signAsync({
      id: admin.id,
      roles: admin.roles.map((item) => item.role),
      permissions: [...new Set(admin.roles.flatMap((item) => item.permissions.map((entry) => entry.permission.key)))],
    });
    await request(app.getHttpServer())
      .get('/api/admin/bookings')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    await request(app.getHttpServer()).get('/api/admin/roles').set('authorization', `Bearer ${adminToken}`).expect(200);
    await request(app.getHttpServer())
      .get('/api/admin/reports')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    await db.walletEntry.create({
      data: {
        userId: user.id,
        transactionId: `tx_e2e_credit_${Date.now()}`,
        account: 'user_wallet',
        direction: 'CREDIT',
        amount: 200000,
        description: 'e2e wallet topup',
        referenceType: 'Test',
        referenceId: user.id,
        idempotencyKey: `e2e-credit:${Date.now()}`,
      },
    });
    const pkg = await db.package.findFirstOrThrow({ where: { approvalStatus: 'APPROVED', active: true } });
    const payment = await request(app.getHttpServer())
      .post('/api/payments')
      .set('authorization', `Bearer ${token}`)
      .send({ purpose: 'package', referenceId: pkg.id, walletAmount: 100000, idempotencyKey: `pkg-${Date.now()}` })
      .expect(201);
    expect(payment.body.status).toBe('PENDING');
    await request(app.getHttpServer())
      .post(`/api/payments/${payment.body.id}/gateway`)
      .set('authorization', `Bearer ${token}`)
      .expect(201);
    const current = await db.payment.findUniqueOrThrow({ where: { id: payment.body.id } });
    await request(app.getHttpServer())
      .get(`/api/payments/callback?Authority=${encodeURIComponent(current.authority!)}&Status=NOK`)
      .expect(200);
    const failed = await db.payment.findUniqueOrThrow({ where: { id: payment.body.id } });
    expect(failed.status).toBe('FAILED');
    const rollback = await db.walletEntry.findUnique({
      where: { idempotencyKey: `wallet-rollback:${payment.body.id}` },
    });
    expect(rollback?.amount).toBe(100000);

    // Role and permission grants come last on purpose. Both call
    // `TokenRevocationService.revokeUser`, which voids every access token this
    // user is already holding — that is the point of it — so doing them earlier
    // would 401 the student's own payment requests above.
    await request(app.getHttpServer())
      .post('/api/admin/roles')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ userId: user.id, role: 'SUPPORT' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/admin/permissions/grant')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ userId: user.id, role: 'SUPPORT', permission: 'tickets.read' })
      .expect(201);
    expect(
      await db.rolePermission.count({
        where: { userId: user.id, role: 'SUPPORT', permission: { key: 'tickets.read' } },
      }),
    ).toBe(1);
  });
  /**
   * SEC-215. `phone` and `googleSubject` are both nullable — either alone is a
   * complete identity — and nothing stopped a row carrying neither. Such a user
   * can never sign in and can never be matched to an inbound login, yet it can
   * still own bookings, payments and a wallet balance.
   *
   * Asserted against the database rather than a service, because the point of
   * the fix is that it holds for every writer, including a migration, a manual
   * `psql` session, or a future code path that forgets.
   */
  it('refuses a user row carrying neither a phone nor a Google subject', async () => {
    await expect(
      db.$executeRaw`INSERT INTO "User" ("id", "updatedAt") VALUES ('e2e-no-identity', now())`,
    ).rejects.toThrow(/User_has_identity/);

    // Either identity alone is still accepted.
    const withPhone = `09${String(Date.now()).slice(-9)}`;
    await db.$executeRaw`INSERT INTO "User" ("id", "phone", "updatedAt") VALUES ('e2e-phone-only', ${withPhone}, now())`;
    await db.$executeRaw`INSERT INTO "User" ("id", "googleSubject", "updatedAt") VALUES ('e2e-google-only', 'e2e-google-subject', now())`;
    await db.user.deleteMany({ where: { id: { in: ['e2e-phone-only', 'e2e-google-only'] } } });
  });
});
