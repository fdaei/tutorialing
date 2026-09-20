import '../src/env';
import {
  AnswerReviewStatus,
  BookingStatus,
  DocumentStatus,
  PriceStatus,
  Prisma,
  PrismaClient,
  ReviewStatus,
  Role,
  TeacherStatus,
  TestStatus,
  TicketDirection,
  TicketMessageType,
  TicketStatus,
} from '@prisma/client';
import { seedCountries } from './country.seed';
import { seedCmsPages } from './cms-pages.seed';
import { seedBlogPosts } from './blog-posts.seed';
import { catalogTeacherId, seedLingoSpeakCatalog } from './lingospeak-catalog.seed';
import { studentPlacementQuestionBanks } from './placement-question-bank';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Production seed disabled');
}

const db = new PrismaClient();
const DAY = 86_400_000;
const now = new Date();
const at = (days: number, hour: number, minute = 0) => {
  const date = new Date(now.getTime() + days * DAY);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
};

// NANP 555-0100 through 555-0199 are reserved for fictional use.
const demoPhone = (suffix: number) => `+120255501${String(suffix).padStart(2, '0')}`;
const normalizeIranianPhone = (local: string) => `+98${local.replace(/^0+/, '')}`;

// The institute's only two teachers, installed by lingospeak-catalog.seed.ts.
const AHMADI = catalogTeacherId('arezoo');
const SHAHFAR = catalogTeacherId('shahriar');
// Their approved prices (catalog REGULAR_PRICE; the trial is always half).
const REGULAR_PRICE = 552_000;
const TRIAL_PRICE = 276_000;
// commerce.commissionPercent below is 20.

const users = {
  admin: {
    id: 'user-admin',
    phone: normalizeIranianPhone('09390315707'),
    name: 'مدیر کل',
    email: 'admin@local.test',
    role: Role.ADMIN,
  },
} as const as any;

const permissionKeys = [
  'users.read',
  'users.manage',
  'teachers.read',
  'teachers.verify',
  'teacher-prices.manage',
  'languages.manage',
  'tests.manage',
  'tests.review',
  'bookings.read',
  'bookings.manage',
  'tickets.read',
  'tickets.manage',
  'payments.read',
  'payments.refund',
  'payments.adjust-wallet',
  'payouts.manage',
  'reviews.manage',
  'courses.manage',
  'audit.read',
  'settings.manage',
  'cms.manage',
  'notifications.read',
  'roles.manage',
  'reports.read',
  'availability.manage',
];

/**
 * Repairs databases seeded while phones were still stored in the local
 * a legacy local form. Signing in with a demo number
 * created a duplicate STUDENT account under the E.164 spelling, so the two rows
 * now sit side by side and the seed's own upsert would collide on the primary
 * key when it reconciles ids.
 *
 * The seeded row wins the number: every later upsert here keys its teacher,
 * booking and ticket fixtures off that deterministic id. The duplicate is parked
 * on a marker instead of being deleted or blanked — most of its relations are
 * `Restrict` so a delete would fail on any row a developer built on it, and the
 * `User_has_identity` check forbids clearing the column outright. The marker is
 * unique, keeps the constraint satisfied, and can never be signed in to because
 * `RequestOtpDto` only accepts `+<digits>`. It also fails the `^0\d{10}$` test
 * below, so a second run skips it rather than swapping the two rows back.
 */
async function normalizeLegacyPhones() {
  const legacy = await db.user.findMany({
    where: { OR: [{ phone: { startsWith: '0' } }, { phone: { startsWith: '98' } }] },
    select: { id: true, phone: true },
  });
  for (const row of legacy) {
    if (!row.phone) continue;
    const phone = /^0\d{10}$/.test(row.phone)
      ? normalizeIranianPhone(row.phone)
      : /^98\d{10}$/.test(row.phone)
        ? `+${row.phone}`
        : null;
    if (!phone) continue;
    const duplicate = await db.user.findUnique({ where: { phone }, select: { id: true } });
    if (duplicate && duplicate.id !== row.id) {
      const parked = `${row.phone}.duplicate.${duplicate.id}`;
      await db.user.update({ where: { id: duplicate.id }, data: { phone: parked } });
      console.warn(`[seed] ${row.phone} -> ${phone}: parked duplicate account left by OTP sign-in as ${parked}`);
    }
    await db.user.update({ where: { id: row.id }, data: { phone } });
  }

  // A previous OTP flow could have created the admin account with a local
  // `989...` spelling. Ensure the canonical account always owns ADMIN.
  const admin = await db.user.findUnique({ where: { phone: users.admin.phone }, select: { id: true } });
  if (admin) {
    await db.userRole.upsert({
      where: { userId_role: { userId: admin.id, role: Role.ADMIN } },
      create: { userId: admin.id, role: Role.ADMIN },
      update: {},
    });
  }
}

async function seedUsersAndPermissions() {
  await normalizeLegacyPhones();
  for (const user of [users.admin]) {
    const existingById = await db.user.findUnique({ where: { id: user.id }, select: { id: true } });
    const phoneOwner = await db.user.findUnique({ where: { phone: user.phone }, select: { id: true } });
    if (phoneOwner && phoneOwner.id !== user.id) {
      const parked = `${user.phone}.duplicate.${phoneOwner.id}`;
      await db.user.update({ where: { id: phoneOwner.id }, data: { phone: parked } });
      console.warn(`[seed] parked conflicting demo phone ${user.phone} on ${parked}`);
    }

    const data = {
      phone: user.phone,
      name: user.name,
      email: user.email,
      profileComplete: true,
      locale: 'fa',
      timezone: 'Asia/Tehran',
      status: 'ACTIVE' as const,
    };
    if (existingById) {
      // Older databases may contain the same deterministic id with a legacy
      // phone format. Reconcile by id before creating roles and relations.
      await db.user.update({ where: { id: user.id }, data });
    } else {
      await db.user.upsert({
        where: { phone: user.phone },
        create: { id: user.id, ...data },
        // A developer may have signed in with a demo phone before running the
        // seed, which creates that user with a random cuid. Reconcile it to the
        // deterministic seed id so all following relation upserts keep working.
        update: { id: user.id, ...data },
      });
    }
    await db.userRole.upsert({
      where: { userId_role: { userId: user.id, role: user.role } },
      create: { userId: user.id, role: user.role },
      update: {},
    });
  }

  // Keep only the primary administrator among the seeded staff roles.
  await db.userRole.deleteMany({
    where: { userId: { in: ['user-verifier', 'user-support', 'user-finance', 'user-examiner'] } },
  });

  // Reconcile demo-role grants instead of only adding them: older seeds gave
  // every staff role every permission, allowing SUPPORT to adjust balances.
  await db.rolePermission.deleteMany({
    where: {
      userId: { in: [users.admin.id] },
    },
  });
  for (const key of permissionKeys) {
    const permission = await db.permission.upsert({
      where: { key },
      create: { key, description: key },
      update: { description: key },
    });
    const actors = [users.admin];
    for (const actor of actors) {
      await db.rolePermission.upsert({
        where: { userId_role_permissionId: { userId: actor.id, role: actor.role, permissionId: permission.id } },
        create: { userId: actor.id, role: actor.role, permissionId: permission.id },
        update: {},
      });
    }
  }
}

const languageRows = [
  ['lang-en', 'en', 'انگلیسی', 'English', 'English', '🇬🇧', 'LTR', 10, 'CEFR'],
  ['lang-de', 'de', 'آلمانی', 'German', 'Deutsch', '🇩🇪', 'LTR', 20, 'CEFR'],
  ['lang-fr', 'fr', 'فرانسوی', 'French', 'Français', '🇫🇷', 'LTR', 30, 'CEFR'],
] as const;

async function seedLanguages() {
  for (const [id, code, nameFa, nameEn, nativeName, flag, direction, order, proficiencySystem] of languageRows) {
    await db.language.upsert({
      where: { code },
      create: { id, code, nameFa, nameEn, nativeName, flag, direction, order, proficiencySystem, active: true },
      update: { nameFa, nameEn, nativeName, flag, direction, order, proficiencySystem, active: true },
    });
  }
  await db.language.deleteMany({ where: { code: { notIn: languageRows.map(([, code]) => code) } } });
}

async function seedTeachers() {
  const policy = await db.cancellationPolicy.upsert({
    where: { id: 'policy-flexible' },
    create: {
      id: 'policy-flexible',
      titleFa: 'انعطاف‌پذیر ۲۴ ساعته',
      titleEn: 'Flexible 24-hour',
      approvedById: users.admin.id,
      rules: {
        tiers: [
          { beforeHours: 24, refundPercent: 100 },
          { beforeHours: 6, refundPercent: 50 },
          { beforeHours: 0, refundPercent: 0 },
        ],
      },
    },
    update: { active: true },
  });

  // Arezoo Ahmadi and Shahriar Shahfar are the institute's only teachers. The
  // catalog seed owns their accounts, profiles and courses on every
  // environment; here they also get the dev-only fixtures (policy,
  // availability, documents). Shahriar's real number has not been supplied, so
  // dev stands in a fictional one.
  await seedLingoSpeakCatalog(db, { placeholderPhones: { shahriar: demoPhone(3) }, policyId: policy.id });
  await retireLegacyDemoTeachers();

  for (const teacherId of [AHMADI, SHAHFAR]) {
    const teacher = await db.teacher.update({
      where: { id: teacherId },
      data: { policyId: policy.id },
      select: { id: true },
    });
    await db.teacherPriceHistory.upsert({
      where: { id: `price-history-${teacher.id}` },
      create: {
        id: `price-history-${teacher.id}`,
        teacherId: teacher.id,
        actorId: users.admin.id,
        actorRole: Role.ADMIN,
        action: 'FINAL_APPROVED',
        status: PriceStatus.APPROVED,
        proposedTrialPrice: TRIAL_PRICE,
        proposedRegularPrice: REGULAR_PRICE,
        approvedTrialPrice: TRIAL_PRICE,
        approvedRegularPrice: REGULAR_PRICE,
      },
      update: {},
    });
    // Office hours, 10:00–17:00 Tehran.
    for (const weekday of [0, 1, 2, 3, 4, 5])
      await db.availabilityRule.upsert({
        where: { id: `rule-${teacher.id}-${weekday}` },
        create: {
          id: `rule-${teacher.id}-${weekday}`,
          teacherId: teacher.id,
          weekday,
          startMinute: 600,
          endMinute: 1020,
          timezone: 'Asia/Tehran',
          lessonDuration: 60,
          breakMinutes: 0,
          active: true,
        },
        update: { startMinute: 600, endMinute: 1020, timezone: 'Asia/Tehran', lessonDuration: 60, active: true },
      });
  }

  const { userId: ahmadiUserId } = await db.teacher.findUniqueOrThrow({ where: { id: AHMADI } });
  const files = [
    {
      id: 'file-teacher-id',
      ownerId: ahmadiUserId,
      key: 'seed/teacher-id.pdf',
      originalName: 'identity.pdf',
      mimeType: 'application/pdf',
      size: 120_000,
      checksum: 'seed-teacher-id',
      purpose: 'teacher_document',
    },
    {
      id: 'file-teacher-video',
      ownerId: ahmadiUserId,
      key: 'seed/intro.mp4',
      originalName: 'intro.mp4',
      mimeType: 'video/mp4',
      size: 1_200_000,
      checksum: 'seed-teacher-video',
      purpose: 'teacher_intro',
    },
  ];
  for (const file of files)
    await db.storedFile.upsert({
      where: { id: file.id },
      create: { ...file, status: 'SAFE' },
      update: { ownerId: file.ownerId, status: 'SAFE' },
    });
  // Belonged to the retired applicant teacher; its verification item is gone.
  await db.storedFile.deleteMany({ where: { id: 'file-pending-certificate', verificationItems: { none: {} } } });

  await db.verificationItem.upsert({
    where: { id: 'verification-approved-id' },
    create: {
      id: 'verification-approved-id',
      teacherId: AHMADI,
      kind: 'IDENTITY',
      fileId: 'file-teacher-id',
      status: DocumentStatus.APPROVED,
      reviewedById: users.admin.id,
      reviewedAt: at(-15, 10),
      submittedAt: at(-20, 9),
    },
    update: {
      teacherId: AHMADI,
      status: DocumentStatus.APPROVED,
      fileId: 'file-teacher-id',
      reviewedById: users.admin.id,
    },
  });

  await db.blockedPeriod.upsert({
    where: { id: 'block-teacher-arezoo' },
    create: {
      id: 'block-teacher-arezoo',
      teacherId: AHMADI,
      startsAt: at(3, 8),
      endsAt: at(3, 10),
      reason: 'جلسه شخصی',
    },
    update: { startsAt: at(3, 8), endsAt: at(3, 10), reason: 'جلسه شخصی' },
  });
}

/**
 * Earlier versions of this seed shipped fictional teachers. On a dev database
 * that still has them, their fixtures (bookings, earnings, reviews, packages…)
 * are re-pointed to the institute's two teachers so the upserts below keep
 * reconciling by id, and the fictional profiles are then removed.
 */
const LEGACY_DEMO_TEACHERS: Record<string, string> = {
  'teacher-sara': AHMADI,
  'teacher-niloofar': AHMADI,
  'teacher-arman': SHAHFAR,
  'teacher-demo-ava': AHMADI,
  'teacher-demo-leila': AHMADI,
  'teacher-demo-shadi': AHMADI,
  'teacher-demo-yuna': AHMADI,
  'teacher-demo-elena': AHMADI,
  'teacher-demo-pouya': SHAHFAR,
  'teacher-demo-navid': SHAHFAR,
  'teacher-demo-amirali': SHAHFAR,
  'teacher-demo-marco': SHAHFAR,
  'teacher-demo-samir': SHAHFAR,
};
const LEGACY_DEMO_TEACHER_USERS = [
  'user-teacher-approved',
  'user-teacher-german',
  'user-teacher-pending',
  ...Object.keys(LEGACY_DEMO_TEACHERS)
    .filter((id) => id.startsWith('teacher-demo-'))
    .map((id) => `user-${id}`),
];

async function retireLegacyDemoTeachers() {
  const legacy = await db.teacher.findMany({
    where: { id: { in: Object.keys(LEGACY_DEMO_TEACHERS) } },
    select: { id: true },
  });
  for (const { id } of legacy) {
    const where = { teacherId: id };
    const data = { teacherId: LEGACY_DEMO_TEACHERS[id]! };
    await db.favorite.deleteMany({ where });
    await db.matchingRecommendation.deleteMany({ where });
    await db.verificationItem.deleteMany({ where });
    await db.blockedPeriod.deleteMany({ where });
    await db.booking.updateMany({ where, data });
    await db.review.updateMany({ where, data });
    await db.package.updateMany({ where, data });
    await db.trialEvaluation.updateMany({ where, data });
    await db.packageRecommendation.updateMany({ where, data });
    await db.learningPlan.updateMany({ where, data });
    await db.earning.updateMany({ where, data });
    await db.payoutItem.updateMany({ where, data });
    await db.withdrawalRequest.updateMany({ where, data });
    await db.course.updateMany({ where, data });
    await db.teacher.delete({ where: { id } });
  }

  // Also covers accounts whose profile an older seed already deleted while
  // leaving the INSTRUCTOR role behind, so the loop above never sees them.
  const accounts = await db.user.findMany({
    where: { id: { in: LEGACY_DEMO_TEACHER_USERS }, teacher: null },
    select: { id: true },
  });
  for (const { id: userId } of accounts) {
    await db.userRole.deleteMany({ where: { userId, role: Role.INSTRUCTOR } });
    // The account may still be referenced (price-history actor, wallet rows…);
    // leaving a role-less dev user behind is harmless.
    await db.user.delete({ where: { id: userId } }).catch(() => {
      console.warn(`[seed] kept legacy demo teacher account ${userId}: still referenced`);
    });
  }
}

async function seedPackages() {
  // The ids predate the current teachers; they are kept so existing dev
  // databases update these rows in place instead of gaining duplicates.
  const rows = [
    { id: 'package-sara-5', teacherId: AHMADI },
    { id: 'package-arman-5', teacherId: SHAHFAR },
  ].map(({ id, teacherId }) => ({
    id,
    teacherId,
    titleFa: 'بسته ۵ جلسه‌ای زبان جنرال انگلیسی',
    titleEn: '5-session General English package',
    descriptionFa: 'پنج جلسه خصوصی آنلاین زبان جنرال انگلیسی.',
    descriptionEn: 'Five private online General English lessons.',
    credits: 5,
    lessonMinutes: 60,
    listPrice: 5 * REGULAR_PRICE,
    discountPercent: 5,
    price: Math.round(5 * REGULAR_PRICE * 0.95),
  }));
  for (const row of rows) {
    await db.package.upsert({
      where: { id: row.id },
      create: { ...row, approvalStatus: 'APPROVED', approvedById: users.admin.id, active: true },
      update: {
        teacherId: row.teacherId,
        titleFa: row.titleFa,
        titleEn: row.titleEn,
        descriptionFa: row.descriptionFa,
        descriptionEn: row.descriptionEn,
        credits: row.credits,
        lessonMinutes: row.lessonMinutes,
        listPrice: row.listPrice,
        discountPercent: row.discountPercent,
        price: row.price,
        approvalStatus: 'APPROVED',
        approvedById: users.admin.id,
        active: true,
      },
    });
  }
}

async function seedTests() {
  const listeningAudio = await db.storedFile.upsert({
    where: { id: 'file-listening-audio' },
    create: {
      id: 'file-listening-audio',
      ownerId: users.admin.id,
      key: 'seed/listening.webm',
      originalName: 'listening.webm',
      mimeType: 'audio/webm',
      size: 90_000,
      checksum: 'seed-listening',
      status: 'SAFE',
      purpose: 'test_audio',
    },
    update: { status: 'SAFE' },
  });
  const speakingAudio = await db.storedFile.upsert({
    where: { id: 'file-speaking-answer' },
    create: {
      id: 'file-speaking-answer',
      ownerId: users.completedStudent.id,
      key: 'seed/speaking-answer.webm',
      originalName: 'speaking-answer.webm',
      mimeType: 'audio/webm',
      size: 140_000,
      checksum: 'seed-speaking-answer',
      status: 'SAFE',
      purpose: 'test_answer',
    },
    update: { status: 'SAFE' },
  });

  const test = await db.testDefinition.upsert({
    where: { slug: 'english-placement-b1' },
    create: {
      id: 'test-english-b1',
      slug: 'english-placement-b1',
      languageId: 'lang-en',
      level: 'B1',
      titleFa: 'تعیین سطح انگلیسی B1',
      titleEn: 'English B1 Placement',
      descriptionFa: 'آزمون مستقل انگلیسی با بخش‌های بسته و تشریحی',
      descriptionEn: 'English-specific assessment with objective and descriptive sections',
      durationMinutes: 75,
      published: true,
    },
    update: { languageId: 'lang-en', level: 'B1', published: true },
  });
  const germanTest = await db.testDefinition.upsert({
    where: { slug: 'german-placement-a2' },
    create: {
      id: 'test-german-a2',
      slug: 'german-placement-a2',
      languageId: 'lang-de',
      level: 'A2',
      titleFa: 'تعیین سطح آلمانی A2',
      titleEn: 'German A2 Placement',
      descriptionFa: 'آزمون مستقل زبان آلمانی',
      descriptionEn: 'German-specific placement assessment',
      durationMinutes: 30,
      published: true,
    },
    update: { languageId: 'lang-de', level: 'A2', published: true },
  });

  const sections = [
    {
      id: 'section-en-listening',
      testId: test.id,
      skill: 'listening',
      title: 'Listening',
      instructions: { fa: 'فایل را گوش کنید.', en: 'Listen to the audio.' },
      durationMinutes: 15,
      order: 1,
    },
    {
      id: 'section-en-writing',
      testId: test.id,
      skill: 'writing',
      title: 'Writing',
      instructions: { fa: 'پاسخ را بنویسید.', en: 'Write your response.' },
      durationMinutes: 40,
      order: 2,
    },
    {
      id: 'section-en-speaking',
      testId: test.id,
      skill: 'speaking',
      title: 'Speaking',
      instructions: { fa: 'پاسخ را ضبط کنید.', en: 'Record your response.' },
      durationMinutes: 20,
      order: 3,
    },
    {
      id: 'section-de-reading',
      testId: germanTest.id,
      skill: 'reading',
      title: 'Lesen',
      instructions: { fa: 'متن آلمانی را بخوانید.', en: 'Read the German text.' },
      durationMinutes: 30,
      order: 1,
    },
  ];
  for (const section of sections)
    await db.testSection.upsert({
      where: { id: section.id },
      create: section,
      update: {
        title: section.title,
        instructions: section.instructions,
        durationMinutes: section.durationMinutes,
        order: section.order,
      },
    });

  const questions = [
    {
      id: 'q-en-listening',
      sectionId: 'section-en-listening',
      prompt: { fa: 'گوینده کجا زندگی می‌کند؟', en: 'Where does the speaker live?' },
      type: 'single_choice',
      choices: { fa: ['لندن', 'لیدز'], en: ['London', 'Leeds'] },
      answerKey: 0,
      audioFileId: listeningAudio.id,
      points: 1,
      order: 1,
    },
    {
      id: 'q-en-writing',
      sectionId: 'section-en-writing',
      prompt: { fa: 'درباره هدف یادگیری خود بنویسید.', en: 'Write about your learning goal.' },
      type: 'essay',
      scoringRule: { minWords: 120 },
      points: 9,
      order: 1,
    },
    {
      id: 'q-en-speaking',
      sectionId: 'section-en-speaking',
      prompt: { fa: 'درباره شهر خود صحبت کنید.', en: 'Talk about your city.' },
      type: 'recording',
      scoringRule: { minSeconds: 30 },
      points: 9,
      order: 1,
    },
    {
      id: 'q-de-reading',
      sectionId: 'section-de-reading',
      prompt: { fa: 'گزینه درست آلمانی را انتخاب کنید.', en: 'Choose the correct German option.' },
      type: 'single_choice',
      choices: { fa: ['Guten Morgen', 'Good morning'], en: ['Guten Morgen', 'Good morning'] },
      answerKey: 0,
      points: 1,
      order: 1,
    },
  ];
  for (const question of questions)
    await db.question.upsert({
      where: { id: question.id },
      create: question,
      update: {
        prompt: question.prompt,
        type: question.type,
        choices: question.choices,
        answerKey: question.answerKey,
        scoringRule: question.scoringRule,
        audioFileId: question.audioFileId,
        points: question.points,
      },
    });

  const completedAttempt = await db.testAttempt.upsert({
    where: { id: 'attempt-completed' },
    create: {
      id: 'attempt-completed',
      userId: users.completedStudent.id,
      testId: test.id,
      status: TestStatus.APPROVED,
      currentSectionId: null,
      startedAt: at(-12, 8),
      expiresAt: at(-12, 10),
      submittedAt: at(-12, 9, 30),
      overallBand: 7,
    },
    update: { status: TestStatus.APPROVED, overallBand: 7, submittedAt: at(-12, 9, 30) },
  });
  const pendingAttempt = await db.testAttempt.upsert({
    where: { id: 'attempt-pending-review' },
    create: {
      id: 'attempt-pending-review',
      userId: users.ticketStudent.id,
      testId: test.id,
      status: TestStatus.UNDER_REVIEW,
      currentSectionId: null,
      startedAt: at(-1, 8),
      expiresAt: at(-1, 10),
      submittedAt: at(-1, 9, 30),
    },
    update: { status: TestStatus.UNDER_REVIEW, submittedAt: at(-1, 9, 30) },
  });

  const completedAnswers = [
    {
      id: 'answer-complete-objective',
      attemptId: completedAttempt.id,
      questionId: 'q-en-listening',
      value: 0,
      autoScore: 1,
      finalScore: 1,
      reviewStatus: null,
    },
    {
      id: 'answer-complete-writing',
      attemptId: completedAttempt.id,
      questionId: 'q-en-writing',
      textValue: 'A complete seed writing response used for the approved review workflow.',
      finalScore: 7,
      reviewStatus: AnswerReviewStatus.APPROVED,
      reviewCriteria: { coherence: 7, grammar: 7 },
      feedbackFa: 'ساختار پاسخ منسجم است.',
      feedbackEn: 'The response is coherent.',
      reviewerId: users.examiner.id,
      reviewedAt: at(-11, 10),
    },
    {
      id: 'answer-complete-speaking',
      attemptId: completedAttempt.id,
      questionId: 'q-en-speaking',
      fileId: speakingAudio.id,
      finalScore: 7,
      reviewStatus: AnswerReviewStatus.APPROVED,
      reviewCriteria: { fluency: 7, pronunciation: 7 },
      feedbackFa: 'روانی و تلفظ مناسب است.',
      feedbackEn: 'Fluency and pronunciation are appropriate.',
      reviewerId: users.examiner.id,
      reviewedAt: at(-11, 10),
    },
    {
      id: 'answer-pending-writing',
      attemptId: pendingAttempt.id,
      questionId: 'q-en-writing',
      textValue: 'This answer is waiting for a human reviewer.',
      reviewStatus: AnswerReviewStatus.PENDING,
    },
    {
      id: 'answer-pending-speaking',
      attemptId: pendingAttempt.id,
      questionId: 'q-en-speaking',
      fileId: speakingAudio.id,
      reviewStatus: AnswerReviewStatus.PENDING,
    },
  ] as const;
  for (const answer of completedAnswers)
    await db.testAnswer.upsert({
      where: { id: answer.id },
      create: answer,
      update: { ...answer },
    });

  for (const row of [
    { id: 'score-completed-listening', attemptId: completedAttempt.id, skill: 'listening', autoBand: 7, finalBand: 7 },
    {
      id: 'score-completed-writing',
      attemptId: completedAttempt.id,
      skill: 'writing',
      finalBand: 7,
      criteria: { coherence: 7, grammar: 7 },
      feedback: 'Approved examiner feedback',
      approvedById: users.examiner.id,
      approvedAt: at(-11, 10),
    },
    {
      id: 'score-completed-speaking',
      attemptId: completedAttempt.id,
      skill: 'speaking',
      finalBand: 7,
      criteria: { fluency: 7 },
      feedback: 'Approved examiner feedback',
      approvedById: users.examiner.id,
      approvedAt: at(-11, 10),
    },
  ])
    await db.testScore.upsert({ where: { id: row.id }, create: row, update: row });
}

async function seedStudentPlacementTests() {
  const tests = [
    {
      id: 'test-student-english-placement',
      slug: 'student-english-placement',
      languageId: 'lang-en',
      titleFa: 'تعیین سطح انگلیسی',
      titleEn: 'English Placement Test',
      descriptionFa: '۳۰ سؤال از سطح A1 تا C1 با نتیجه فوری بر اساس CEFR.',
      descriptionEn: '30 questions from A1 to C1 with an immediate CEFR result.',
      bank: studentPlacementQuestionBanks.en,
    },
    {
      id: 'test-student-german-placement',
      slug: 'student-german-placement',
      languageId: 'lang-de',
      titleFa: 'تعیین سطح آلمانی',
      titleEn: 'German Placement Test',
      descriptionFa: '۳۰ سؤال از سطح A1 تا C1 با نتیجه فوری بر اساس CEFR.',
      descriptionEn: '30 questions from A1 to C1 with an immediate CEFR result.',
      bank: studentPlacementQuestionBanks.de,
    },
    {
      id: 'test-student-french-placement',
      slug: 'student-french-placement',
      languageId: 'lang-fr',
      titleFa: 'تعیین سطح فرانسوی',
      titleEn: 'French Placement Test',
      descriptionFa: '۳۰ سؤال از سطح A1 تا C1 با نتیجه فوری بر اساس CEFR.',
      descriptionEn: '30 questions from A1 to C1 with an immediate CEFR result.',
      bank: studentPlacementQuestionBanks.fr,
    },
  ] as const;

  for (const test of tests) {
    const definition = await db.testDefinition.upsert({
      where: { slug: test.slug },
      create: {
        id: test.id,
        slug: test.slug,
        languageId: test.languageId,
        level: 'A1-C1',
        titleFa: test.titleFa,
        titleEn: test.titleEn,
        descriptionFa: test.descriptionFa,
        descriptionEn: test.descriptionEn,
        durationMinutes: 10,
        published: true,
        isPlacement: true,
      },
      update: {
        languageId: test.languageId,
        level: 'A1-C1',
        titleFa: test.titleFa,
        titleEn: test.titleEn,
        descriptionFa: test.descriptionFa,
        descriptionEn: test.descriptionEn,
        durationMinutes: 10,
        published: true,
        isPlacement: true,
      },
    });

    const levels = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
    for (const [sectionIndex, level] of levels.entries()) {
      const section = await db.testSection.upsert({
        where: { id: `section-student-${test.languageId.slice(-2)}-${level.toLowerCase()}` },
        create: {
          id: `section-student-${test.languageId.slice(-2)}-${level.toLowerCase()}`,
          testId: definition.id,
          skill: 'placement',
          title: level,
          instructions: {
            fa: 'بهترین پاسخ را برای هر سؤال انتخاب کنید.',
            en: 'Choose the best answer for each question.',
          },
          durationMinutes: 2,
          order: sectionIndex + 1,
        },
        update: {
          testId: definition.id,
          skill: 'placement',
          title: level,
          instructions: {
            fa: 'بهترین پاسخ را برای هر سؤال انتخاب کنید.',
            en: 'Choose the best answer for each question.',
          },
          durationMinutes: 2,
          order: sectionIndex + 1,
        },
      });

      const questions = test.bank
        .map((question, index) => ({ question, index }))
        .filter(({ question }) => question.level === level);
      for (const { question, index } of questions) {
        await db.question.upsert({
          where: { id: `q-student-${test.languageId.slice(-2)}-${index + 1}` },
          create: {
            id: `q-student-${test.languageId.slice(-2)}-${index + 1}`,
            sectionId: section.id,
            prompt: { fa: question.prompt, en: question.prompt },
            type: 'single_choice',
            choices: { fa: question.choices, en: question.choices },
            answerKey: question.answerKey,
            points: 1,
            order: index + 1,
          },
          update: {
            sectionId: section.id,
            prompt: { fa: question.prompt, en: question.prompt },
            type: 'single_choice',
            choices: { fa: question.choices, en: question.choices },
            answerKey: question.answerKey,
            points: 1,
            order: index + 1,
          },
        });
      }
    }
  }
}

async function removeMockPlacementTests() {
  const mockTests = await db.testDefinition.findMany({
    where: { id: { in: ['test-english-b1', 'test-german-a2'] } },
    select: { id: true },
  });
  const testIds = mockTests.map(({ id }) => id);
  if (testIds.length === 0) return;

  await db.placementResult.deleteMany({ where: { testId: { in: testIds } } });
  await db.testAttempt.deleteMany({ where: { testId: { in: testIds } } });
  await db.testDefinition.deleteMany({ where: { id: { in: testIds } } });
}

async function seedBookingsFinanceAndReviews() {
  // Finance screens must start empty in the development seed. Remove the
  // records created by older versions of this seed before creating bookings.
  await db.payoutItem.deleteMany({ where: { id: 'payout-item-paid' } });
  await db.payoutBatch.deleteMany({ where: { id: 'payout-previous' } });
  await db.earning.deleteMany({ where: { id: { in: ['earning-eligible', 'earning-paid'] } } });
  await db.payment.deleteMany({
    where: { id: { in: ['payment-booking-completed-eligible', 'payment-booking-completed-paid', 'payment-booking-future-confirmed'] } },
  });

  const completed = await db.booking.upsert({
    where: { id: 'booking-completed-eligible' },
    create: {
      id: 'booking-completed-eligible',
      studentId: users.completedStudent.id,
      teacherId: AHMADI,
      startsAt: at(-10, 9),
      endsAt: at(-10, 10),
      timezone: 'Asia/Tehran',
      type: 'regular',
      status: BookingStatus.COMPLETED,
      price: REGULAR_PRICE,
      policySnapshot: {},
      attendanceStudent: true,
      attendanceTeacher: true,
      meetingUrl: 'https://meet.local/completed',
    },
    update: {
      teacherId: AHMADI,
      price: REGULAR_PRICE,
      status: BookingStatus.COMPLETED,
      attendanceStudent: true,
      attendanceTeacher: true,
    },
  });
  await db.booking.upsert({
    where: { id: 'booking-completed-paid' },
    create: {
      id: 'booking-completed-paid',
      studentId: users.completedStudent.id,
      teacherId: AHMADI,
      startsAt: at(-24, 9),
      endsAt: at(-24, 10),
      timezone: 'Asia/Tehran',
      type: 'regular',
      status: BookingStatus.COMPLETED,
      price: REGULAR_PRICE,
      policySnapshot: {},
      attendanceStudent: true,
      attendanceTeacher: true,
    },
    update: {
      teacherId: AHMADI,
      price: REGULAR_PRICE,
      status: BookingStatus.COMPLETED,
      attendanceStudent: true,
      attendanceTeacher: true,
    },
  });
  await db.booking.upsert({
    where: { id: 'booking-future-confirmed' },
    create: {
      id: 'booking-future-confirmed',
      studentId: users.futureStudent.id,
      teacherId: SHAHFAR,
      startsAt: at(5, 12),
      endsAt: at(5, 13),
      timezone: 'Asia/Tehran',
      type: 'trial',
      status: BookingStatus.CONFIRMED,
      price: TRIAL_PRICE,
      policySnapshot: {},
      meetingUrl: 'https://meet.local/future',
    },
    update: {
      teacherId: SHAHFAR,
      price: TRIAL_PRICE,
      startsAt: at(5, 12),
      endsAt: at(5, 13),
      status: BookingStatus.CONFIRMED,
    },
  });
  await db.booking.upsert({
    where: { id: 'booking-cancelled' },
    create: {
      id: 'booking-cancelled',
      studentId: users.ticketStudent.id,
      teacherId: AHMADI,
      startsAt: at(-4, 12),
      endsAt: at(-4, 13),
      timezone: 'Asia/Tehran',
      type: 'trial',
      status: BookingStatus.CANCELLED,
      price: TRIAL_PRICE,
      policySnapshot: {},
      cancelledAt: at(-5, 10),
      cancellationReason: 'لغو توسط زبان‌آموز',
    },
    update: {
      teacherId: AHMADI,
      price: TRIAL_PRICE,
      status: BookingStatus.CANCELLED,
      cancellationReason: 'لغو توسط زبان‌آموز',
    },
  });

  await db.review.upsert({
    where: { bookingId: completed.id },
    create: {
      id: 'review-approved',
      teacherId: completed.teacherId,
      studentId: completed.studentId,
      bookingId: completed.id,
      rating: 5,
      comment: 'کلاس منظم و بازخوردها بسیار کاربردی بود.',
      moderationStatus: ReviewStatus.APPROVED,
      published: true,
      moderatedById: users.admin.id,
      moderatedAt: at(-8, 9),
      teacherResponse: 'از اعتماد شما ممنونم.',
      respondedAt: at(-7, 9),
    },
    update: {
      teacherId: completed.teacherId,
      rating: 5,
      moderationStatus: ReviewStatus.APPROVED,
      published: true,
      moderatedById: users.admin.id,
    },
  });
  const rating = await db.review.aggregate({
    where: { teacherId: completed.teacherId, published: true, moderationStatus: ReviewStatus.APPROVED },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await db.teacher.update({
    where: { id: completed.teacherId },
    data: { rating: rating._avg.rating ?? 0, reviewsCount: rating._count._all },
  });

}

async function seedDemoExperience() {
  const student = users.demoStudent;
  await db.walletEntry.deleteMany({ where: { id: { startsWith: 'wallet-demo-' } } });
  await db.payment.deleteMany({ where: { id: { startsWith: 'payment-booking-demo-' } } });
  const testSpecs = [
    [
      'test-demo-ielts',
      'ielts-academic-full-demo',
      'lang-en',
      'IELTS',
      'آزمون جامع IELTS Academic',
      'IELTS Academic Full Mock',
      165,
    ],
    ['test-demo-german', 'german-demo-b1', 'lang-de', 'B1', 'آزمون تعیین سطح آلمانی', 'German Placement Test', 45],
    ['test-demo-french', 'french-demo-a2', 'lang-fr', 'A2', 'آزمون تعیین سطح فرانسوی', 'French Placement Test', 40],
  ] as const;
  for (const [id, slug, languageId, level, titleFa, titleEn, durationMinutes] of testSpecs)
    await db.testDefinition.upsert({
      where: { slug },
      create: {
        id,
        slug,
        languageId,
        level,
        titleFa,
        titleEn,
        descriptionFa: 'آزمون استاندارد نمایشی با سؤالات واقع‌گرایانه برای تجربه کامل سامانه',
        descriptionEn: 'A realistic full-flow demonstration assessment',
        durationMinutes,
        published: true,
      },
      update: { published: true, titleFa, titleEn, durationMinutes },
    });
  const ieltsSections = [
    ['listening', 'Listening', 30],
    ['reading', 'Academic Reading', 60],
    ['writing', 'Academic Writing', 60],
    ['speaking', 'Speaking', 15],
  ] as const;
  for (let i = 0; i < ieltsSections.length; i += 1) {
    const [skill, title, durationMinutes] = ieltsSections[i]!;
    await db.testSection.upsert({
      where: { id: `section-demo-ielts-${skill}` },
      create: {
        id: `section-demo-ielts-${skill}`,
        testId: 'test-demo-ielts',
        skill,
        title,
        instructions: {
          fa: `دستورالعمل بخش ${title} را بخوانید و در زمان تعیین‌شده پاسخ دهید.`,
          en: `Complete the ${title} section within the time limit.`,
        },
        durationMinutes,
        order: i + 1,
      },
      update: { title, durationMinutes, order: i + 1 },
    });
  }
  const simpleSections = [
    ['german', 'test-demo-german', 'Lesen'],
    ['french', 'test-demo-french', 'Compréhension'],
  ] as const;
  for (const [key, testId, title] of simpleSections)
    await db.testSection.upsert({
      where: { id: `section-demo-${key}` },
      create: {
        id: `section-demo-${key}`,
        testId,
        skill: 'reading',
        title,
        instructions: { fa: 'متن را بخوانید و پاسخ درست را انتخاب کنید.', en: 'Read and choose the correct answer.' },
        durationMinutes: 40,
        order: 1,
      },
      update: { title },
    });
  const demoQuestions = [
    [
      'q-demo-ielts-l1',
      'section-demo-ielts-listening',
      'single_choice',
      'سخنران جلسه را برای چه ساعتی تنظیم می‌کند؟',
      'What time does the speaker arrange the meeting?',
      ['۹:۳۰', '۱۰:۰۰', '۱۰:۳۰', '۱۱:۰۰'],
      1,
    ],
    [
      'q-demo-ielts-r1',
      'section-demo-ielts-reading',
      'single_choice',
      'طبق متن، مهم‌ترین مزیت یادگیری ترکیبی چیست؟',
      'According to the passage, what is the main benefit of blended learning?',
      ['کاهش کامل هزینه', 'انعطاف‌پذیری همراه با تعامل', 'حذف مدرس', 'آزمون کمتر'],
      1,
    ],
    [
      'q-demo-ielts-w1',
      'section-demo-ielts-writing',
      'essay',
      'نموداری روند یادگیری آنلاین را نشان می‌دهد. ویژگی‌های اصلی را خلاصه و مقایسه کنید.',
      'The chart shows trends in online learning. Summarise and compare the main features.',
      null,
      null,
    ],
    [
      'q-demo-ielts-w2',
      'section-demo-ielts-writing',
      'essay',
      'برخی معتقدند آموزش آنلاین جای کلاس حضوری را می‌گیرد. تا چه حد موافقید؟',
      'Some believe online education will replace classrooms. To what extent do you agree?',
      null,
      null,
    ],
    [
      'q-demo-ielts-s1',
      'section-demo-ielts-speaking',
      'recording',
      'درباره مهارتی که دوست دارید در آینده یاد بگیرید صحبت کنید.',
      'Describe a skill you would like to learn in the future.',
      null,
      null,
    ],
    [
      'q-demo-german',
      'section-demo-german',
      'single_choice',
      'کدام جمله از نظر دستوری درست است؟',
      'Which sentence is grammatically correct?',
      ['Ich gehe heute zur Arbeit.', 'Ich heute gehen Arbeit.', 'Heute ich Arbeit geht.'],
      0,
    ],
    [
      'q-demo-french',
      'section-demo-french',
      'single_choice',
      'عبارت درست برای معرفی خود چیست؟',
      'Choose the correct introduction.',
      ['Je m’appelle Marie.', 'Je suis appelle Marie.', 'Moi appeler Marie.'],
      0,
    ],
  ] as const;
  for (let i = 0; i < demoQuestions.length; i += 1) {
    const [id, sectionId, type, promptFa, promptEn, choices, answerKey] = demoQuestions[i]!;
    await db.question.upsert({
      where: { id },
      create: {
        id,
        sectionId,
        type,
        prompt: { fa: promptFa, en: promptEn },
        choices: choices ? { fa: choices, en: choices } : undefined,
        answerKey: answerKey ?? undefined,
        scoringRule:
          type === 'essay'
            ? { minWords: id.endsWith('w2') ? 250 : 150 }
            : type === 'recording'
              ? { minSeconds: 60 }
              : undefined,
        points: type === 'single_choice' ? 1 : 9,
        order: i + 1,
      },
      update: {
        prompt: { fa: promptFa, en: promptEn },
        choices: choices ? { fa: choices, en: choices } : undefined,
        answerKey: answerKey ?? undefined,
      },
    });
  }

  const attempts = [
    ['attempt-demo-ielts', 'test-demo-ielts', TestStatus.IN_PROGRESS, undefined, undefined],
    ['attempt-demo-german', 'test-demo-german', TestStatus.APPROVED, 6.5, -18],
    ['attempt-demo-french', 'test-demo-french', TestStatus.APPROVED, 5.5, -35],
  ] as const;
  for (const [id, testId, status, overallBand, days] of attempts)
    await db.testAttempt.upsert({
      where: { id },
      create: {
        id,
        userId: student.id,
        testId,
        status,
        currentSectionId: status === TestStatus.IN_PROGRESS ? 'section-demo-ielts-listening' : null,
        startedAt: at(days ?? -1, 8),
        expiresAt: at((days ?? -1) + 2, 8),
        submittedAt: status === TestStatus.IN_PROGRESS ? null : at(days ?? -1, 10),
        overallBand,
      },
      update: {
        status,
        currentSectionId: status === TestStatus.IN_PROGRESS ? 'section-demo-ielts-listening' : null,
        overallBand,
        submittedAt: status === TestStatus.IN_PROGRESS ? null : at(days ?? -1, 10),
      },
    });
  for (const [skill, , duration] of ieltsSections)
    await db.attemptSectionState.upsert({
      where: { attemptId_sectionId: { attemptId: 'attempt-demo-ielts', sectionId: `section-demo-ielts-${skill}` } },
      create: {
        attemptId: 'attempt-demo-ielts',
        sectionId: `section-demo-ielts-${skill}`,
        status: skill === 'listening' ? 'available' : 'locked',
        remainingSeconds: duration * 60,
      },
      update: { remainingSeconds: duration * 60 },
    });

  const session = await db.matchingSession.upsert({
    where: { id: 'match-demo-student' },
    create: {
      id: 'match-demo-student',
      userId: student.id,
      languageId: 'lang-en',
      currentLevel: 'B2',
      learningGoal: 'IELTS Academic 7.5',
      targetLevel: 'C1',
      targetBand: 7.5,
      currentBand: 6.5,
      examDate: at(90, 8),
      weakSkills: ['writing', 'speaking'],
      maxTrialPrice: 400000,
      availability: { days: [1, 3, 5], time: 'evening' },
      suitableDays: [1, 3, 5],
      preferredTime: 'evening',
      trialRequired: true,
      classType: 'private',
      timezone: 'Asia/Tehran',
    },
    update: { targetBand: 7.5, currentBand: 6.5 },
  });
  await db.matchingRecommendation.deleteMany({ where: { sessionId: session.id } });
  const recommended = [AHMADI, SHAHFAR];
  for (let rank = 1; rank <= recommended.length; rank += 1) {
    const teacherId = recommended[rank - 1]!;
    await db.matchingRecommendation.upsert({
      where: { sessionId_rank: { sessionId: session.id, rank } },
      create: {
        sessionId: session.id,
        teacherId,
        rank,
        score: 96 - rank * 2,
        reasons: { fa: ['هماهنگ با بودجه و زمان شما', 'تجربه تدریس آنلاین'], en: ['Matches your budget and schedule'] },
        audit: { compatibleSlots: 12 - (rank % 4), price: TRIAL_PRICE },
      },
      update: { teacherId, score: 96 - rank * 2 },
    });
  }

  const bookings = [
    ['booking-demo-completed', AHMADI, -8, BookingStatus.COMPLETED, 'regular', REGULAR_PRICE],
    ['booking-demo-upcoming', SHAHFAR, 3, BookingStatus.CONFIRMED, 'trial', TRIAL_PRICE],
    // A regular lesson: the learner already had a lesson with Arezoo, and a
    // trial is only available once per learner-teacher pair.
    ['booking-demo-upcoming-2', AHMADI, 7, BookingStatus.CONFIRMED, 'regular', REGULAR_PRICE],
  ] as const;
  for (const [id, teacherId, days, status, type, price] of bookings) {
    const booking = await db.booking.upsert({
      where: { id },
      create: {
        id,
        studentId: student.id,
        teacherId,
        startsAt: at(days, 14),
        endsAt: at(days, 15),
        timezone: 'Asia/Tehran',
        type,
        status,
        price,
        policySnapshot: { title: 'flexible' },
        meetingUrl: `https://meet.jit.si/lingospeak-${id}`,
        attendanceStudent: status === BookingStatus.COMPLETED ? true : null,
        attendanceTeacher: status === BookingStatus.COMPLETED ? true : null,
      },
      update: { teacherId, type, price, startsAt: at(days, 14), endsAt: at(days, 15), status },
    });
  }
  await db.learningPlan.upsert({
    where: { id: 'plan-demo-ielts' },
    create: {
      id: 'plan-demo-ielts',
      studentId: student.id,
      teacherId: AHMADI,
      title: 'مسیر آمادگی IELTS Academic نمره ۷٫۵',
      targetBand: 7.5,
      examDate: at(90, 8),
      weakSkills: ['writing', 'speaking'],
      status: 'active',
      milestones: {
        create: [
          { title: 'تسلط بر Writing Task 1', dueAt: at(20, 8), order: 1 },
          { title: 'آزمون آزمایشی کامل', dueAt: at(55, 8), order: 2 },
          { title: 'مرور نهایی Speaking', dueAt: at(80, 8), order: 3 },
        ],
      },
      assignments: {
        create: [
          {
            title: 'تحلیل نمودار خطی',
            instructions: 'یک پاسخ ۱۵۰ کلمه‌ای برای Task 1 بنویسید.',
            dueAt: at(4, 8),
            status: 'pending',
          },
          {
            title: 'ضبط Speaking Part 2',
            instructions: 'دو دقیقه درباره یک تجربه آموزشی صحبت کنید.',
            dueAt: at(6, 8),
            status: 'pending',
          },
        ],
      },
    },
    update: { teacherId: AHMADI, title: 'مسیر آمادگی IELTS Academic نمره ۷٫۵', targetBand: 7.5, status: 'active' },
  });
}

async function seedTicketsCmsAndSettings() {
  const ticket = await db.ticket.upsert({
    where: { id: 'ticket-assigned-open' },
    create: {
      id: 'ticket-assigned-open',
      userId: users.ticketStudent.id,
      subject: 'مشکل در مشاهده نوبت رزروشده',
      category: 'booking',
      priority: 'HIGH',
      status: TicketStatus.IN_PROGRESS,
      assignedToId: users.support.id,
      slaDueAt: at(1, 12),
      lastReplyAt: at(0, 8),
    },
    update: { status: TicketStatus.IN_PROGRESS, assignedToId: users.support.id, slaDueAt: at(1, 12) },
  });
  const replies = [
    {
      id: 'ticket-reply-user',
      authorId: users.ticketStudent.id,
      authorRole: Role.STUDENT,
      direction: TicketDirection.INBOUND,
      messageType: TicketMessageType.USER_MESSAGE,
      body: 'نوبت آینده در داشبورد من نمایش داده نمی‌شود.',
      internal: false,
      createdAt: at(-1, 8),
    },
    {
      id: 'ticket-reply-support',
      authorId: users.support.id,
      authorRole: Role.SUPPORT,
      direction: TicketDirection.OUTBOUND,
      messageType: TicketMessageType.STAFF_REPLY,
      body: 'موضوع را بررسی می‌کنیم و نتیجه را اطلاع می‌دهیم.',
      internal: false,
      createdAt: at(-1, 9),
    },
    {
      id: 'ticket-reply-note',
      authorId: users.support.id,
      authorRole: Role.SUPPORT,
      direction: TicketDirection.INTERNAL,
      messageType: TicketMessageType.INTERNAL_NOTE,
      body: 'کش رزروها پس از اصلاح باید invalidate شود.',
      internal: true,
      createdAt: at(-1, 9, 10),
    },
  ];
  for (const reply of replies)
    await db.ticketReply.upsert({
      where: { id: reply.id },
      create: { ...reply, ticketId: ticket.id },
      update: { body: reply.body },
    });
  await db.ticketStatusHistory.upsert({
    where: { id: 'ticket-status-history-open' },
    create: {
      id: 'ticket-status-history-open',
      ticketId: ticket.id,
      fromStatus: TicketStatus.OPEN,
      toStatus: TicketStatus.IN_PROGRESS,
      actorId: users.support.id,
      note: 'بررسی آغاز شد.',
    },
    update: { toStatus: TicketStatus.IN_PROGRESS, note: 'بررسی آغاز شد.' },
  });
  await db.ticketAssignmentHistory.upsert({
    where: { id: 'ticket-assignment-history' },
    create: {
      id: 'ticket-assignment-history',
      ticketId: ticket.id,
      toAssigneeId: users.support.id,
      actorId: users.admin.id,
      note: 'ارجاع به پشتیبانی رزروها',
    },
    update: { toAssigneeId: users.support.id },
  });
  await db.notification.upsert({
    where: { id: 'notification-ticket-assigned' },
    create: {
      id: 'notification-ticket-assigned',
      userId: users.support.id,
      type: 'TICKET_ASSIGNED',
      titleFa: 'تیکت جدید به شما ارجاع شد',
      titleEn: 'A ticket was assigned to you',
      bodyFa: ticket.subject,
      bodyEn: ticket.subject,
      data: { ticketId: ticket.id, href: `/admin/tickets/${ticket.id}` },
    },
    update: { data: { ticketId: ticket.id, href: `/admin/tickets/${ticket.id}` } },
  });

  const supportPhone = {
    number: '09914673683',
    hoursFa: 'ساعت کاری ۱۰ صبح تا ۵ عصر',
    hoursEn: 'Office hours 10:00–17:00',
  };
  await db.setting.upsert({
    where: { key: 'support.phone' },
    create: {
      key: 'support.phone',
      value: supportPhone,
      public: true,
    },
    update: { value: supportPhone, public: true },
  });
  await db.setting.upsert({
    where: { key: 'sms.enabled' },
    create: { key: 'sms.enabled', value: { enabled: false }, public: false },
    update: { value: { enabled: false } },
  });

  // Commerce and booking rules the admin panel is expected to govern. These are
  // seeded rather than hardcoded so changing them never needs a deploy; each
  // reader falls back to the same default when the row is missing.
  const rules: [string, unknown, boolean][] = [
    ['payment.card', { cardNumber: '0000-0000-0000-0000', holder: 'نام صاحب حساب', bank: 'نام بانک' }, true],
    ['commerce.commissionPercent', { value: 20 }, false],
    ['commerce.escrowHoldDays', { value: 7 }, false],
    ['booking.minLeadMinutes', { value: 120 }, true],
    ['booking.maxAdvanceDays', { value: 60 }, true],
    ['reviews.autoDeactivateOneStarCount', { value: 5 }, false],
    // Replace with the real GA4 Measurement ID from the admin settings panel.
    ['analytics.googleMeasurementId', { value: 'G-XXXXXXXXXX' }, true],
  ];
  for (const [key, value, isPublic] of rules) {
    await db.setting.upsert({
      where: { key },
      create: { key, value: value as object, public: isPublic },
      update: {},
    });
  }

  // The birthday discount, as a rule row rather than a hardcoded branch: 20% off
  // capped at 200,000, valid within a week either side of the student's birthday.
  const birthdayRule = await db.discountRule.findFirst({ where: { trigger: 'BIRTHDAY' } });
  if (!birthdayRule) {
    await db.discountRule.create({
      data: { trigger: 'BIRTHDAY', type: 'percent', value: 20, maxAmount: 200_000, windowDays: 7, active: true },
    });
  }

  await seedCmsPages(db);
}

async function seedAudit() {
  const rows: Array<{
    actorId: string;
    action: string;
    entity: string;
    entityId: string;
    after: Prisma.InputJsonValue;
  }> = [
    {
      actorId: users.admin.id,
      action: 'teacher.price.final_approved',
      entity: 'Teacher',
      entityId: AHMADI,
      after: { approvedTrialPrice: TRIAL_PRICE, approvedRegularPrice: REGULAR_PRICE },
    },
    {
      actorId: users.admin.id,
      action: 'teacher.document.needs_revision',
      entity: 'VerificationItem',
      entityId: 'verification-pending-certificate',
      after: { reason: 'Unreadable stamp' },
    },
    {
      actorId: users.admin.id,
      action: 'ticket.assigned',
      entity: 'Ticket',
      entityId: 'ticket-assigned-open',
      after: { assignedToId: users.admin.id },
    },
  ];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    await db.auditLog.upsert({
      where: { id: `seed-audit-${index + 1}` },
      create: { id: `seed-audit-${index + 1}`, ...row },
      update: { after: row.after },
    });
  }
}

async function seedBlog() {
  // Long-form editorial baseline shared with the production runner seed-blog.ts;
  // the dev seed overwrites so content edits in blog-content/ show up on re-seed.
  await seedBlogPosts(db, { authorId: users.admin.id, overwrite: true, now });
}

async function seedCourses() {
  // The course catalog is the institute's own, installed by
  // lingospeak-catalog.seed.ts from seedTeachers(). These fictional courses
  // predate it; their chapters, lessons, enrollments and reviews cascade.
  await db.course.deleteMany({
    where: {
      id: {
        in: ['course-spanish-everyday', 'course-english-conversation', 'course-german-zero', 'course-french-travel'],
      },
    },
  });
}

async function main() {
  await seedUsersAndPermissions();
  await seedLanguages();
  await seedCountries(db);
  await seedTeachers();
  await seedPackages();
  await removeMockPlacementTests();
  await seedStudentPlacementTests();
  // Student/staff demo fixtures are intentionally excluded from the default seed.
  await seedBlog();
  await seedCourses();
  await seedAudit();
  console.log('Seed completed successfully with multilingual workflow data.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
