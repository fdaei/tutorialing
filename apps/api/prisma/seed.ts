import '../src/env';
import {
  AnswerReviewStatus,
  BookingStatus,
  DocumentStatus,
  EarningStatus,
  PaymentStatus,
  PayoutStatus,
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
  BlogPostStatus,
} from '@prisma/client';
import { seedCountries } from './country.seed';

const db = new PrismaClient();
const DAY = 86_400_000;
const now = new Date();
const at = (days: number, hour: number, minute = 0) => {
  const date = new Date(now.getTime() + days * DAY);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
};

/**
 * Every sign-in path stores and looks phones up in E.164, so the seed must too.
 * The web client posts `+98` + the local number and `RequestOtpDto` rejects
 * anything that is not `+<digits>`, after which `AuthService.requestOtp` upserts
 * on that exact string. A row written as `09120000000` is therefore never
 * matched: signing in with a demo number quietly created a *second*,
 * STUDENT-only account under `+989120000000` and the seeded ADMIN/STAFF roles
 * stayed unreachable. Numbers stay in the readable local form at the call sites
 * because that is what the login form asks for — it strips the leading zero and
 * prepends the country's dial code itself.
 */
const e164 = (local: string) => `+98${local.replace(/^0+/, '')}`;

const users = {
  admin: { id: 'user-admin', phone: e164('09120000000'), name: 'مدیر کل', email: 'admin@local.test', role: Role.ADMIN },
  verifier: {
    id: 'user-verifier',
    phone: e164('09120000010'),
    name: 'کارشناس تأیید مدرس',
    email: 'verifier@local.test',
    role: Role.ADMIN,
  },
  support: {
    id: 'user-support',
    phone: e164('09120000011'),
    name: 'کارشناس پشتیبانی',
    email: 'support@local.test',
    role: Role.SUPPORT,
  },
  finance: {
    id: 'user-finance',
    phone: e164('09120000012'),
    name: 'کارشناس مالی',
    email: 'finance@local.test',
    role: Role.SUPPORT,
  },
  examiner: {
    id: 'user-examiner',
    phone: e164('09120000013'),
    name: 'ارزیاب آزمون',
    email: 'examiner@local.test',
    role: Role.SUPPORT,
  },
  approvedTeacher: {
    id: 'user-teacher-approved',
    phone: e164('09120000001'),
    name: 'سارا دادخواه',
    email: 'sara@local.test',
    role: Role.INSTRUCTOR,
  },
  germanTeacher: {
    id: 'user-teacher-german',
    phone: e164('09120000002'),
    name: 'آرمان نیک‌روش',
    email: 'arman@local.test',
    role: Role.INSTRUCTOR,
  },
  pendingTeacher: {
    id: 'user-teacher-pending',
    phone: e164('09120000004'),
    name: 'نیلوفر آذری',
    email: 'niloofar@local.test',
    role: Role.INSTRUCTOR,
  },
  completedStudent: {
    id: 'user-student-completed',
    phone: e164('09121111111'),
    name: 'نازنین کاظمی',
    email: 'nazanin@local.test',
    role: Role.STUDENT,
  },
  futureStudent: {
    id: 'user-student-future',
    phone: e164('09121111112'),
    name: 'علی رضایی',
    email: 'ali@local.test',
    role: Role.STUDENT,
  },
  ticketStudent: {
    id: 'user-student-ticket',
    phone: e164('09121111113'),
    name: 'مریم احمدی',
    email: 'maryam@local.test',
    role: Role.STUDENT,
  },
  demoStudent: {
    id: 'user-student-demo-09390315707',
    phone: e164('09390315707'),
    name: 'کاربر نمایشی لینگواسپیک',
    email: 'demo.student@local.test',
    role: Role.STUDENT,
  },
} as const;

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
 * `09xxxxxxxxx` form (see the `e164` note above). Signing in with a demo number
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
  const legacy = await db.user.findMany({ where: { phone: { startsWith: '0' } }, select: { id: true, phone: true } });
  for (const row of legacy) {
    if (!row.phone || !/^0\d{10}$/.test(row.phone)) continue;
    const phone = e164(row.phone);
    const duplicate = await db.user.findUnique({ where: { phone }, select: { id: true } });
    if (duplicate && duplicate.id !== row.id) {
      const parked = `${row.phone}.duplicate.${duplicate.id}`;
      await db.user.update({ where: { id: duplicate.id }, data: { phone: parked } });
      console.warn(`[seed] ${row.phone} -> ${phone}: parked duplicate account left by OTP sign-in as ${parked}`);
    }
    await db.user.update({ where: { id: row.id }, data: { phone } });
  }
}

async function seedUsersAndPermissions() {
  await normalizeLegacyPhones();
  for (const user of Object.values(users)) {
    await db.user.upsert({
      where: { phone: user.phone },
      create: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        profileComplete: true,
        locale: 'fa',
        timezone: 'Asia/Tehran',
      },
      // A developer may have signed in with a demo phone before running the
      // seed, which creates that user with a random cuid. Reconcile it to the
      // deterministic seed id so all following role and relation upserts keep
      // working on repeated runs (Prisma cascades the id update locally).
      update: { id: user.id, name: user.name, email: user.email, profileComplete: true, status: 'ACTIVE' },
    });
    await db.userRole.upsert({
      where: { userId_role: { userId: user.id, role: user.role } },
      create: { userId: user.id, role: user.role },
      update: {},
    });
  }

  // Reconcile demo-role grants instead of only adding them: older seeds gave
  // every staff role every permission, allowing SUPPORT to adjust balances.
  await db.rolePermission.deleteMany({
    where: {
      userId: { in: [users.admin.id, users.verifier.id, users.support.id, users.finance.id, users.examiner.id] },
    },
  });
  for (const key of permissionKeys) {
    const permission = await db.permission.upsert({
      where: { key },
      create: { key, description: key },
      update: { description: key },
    });
    const financeKeys = new Set([
      'payments.read',
      'payments.refund',
      'payments.adjust-wallet',
      'payouts.manage',
      'reports.read',
      'audit.read',
    ]);
    const supportKeys = new Set(['users.read', 'bookings.read', 'tickets.read', 'tickets.manage', 'payments.read']);
    const examinerKeys = new Set(['tests.manage', 'tests.review']);
    const verifierKeys = new Set([
      'users.read',
      'teachers.read',
      'teachers.verify',
      'teacher-prices.manage',
      'reviews.manage',
    ]);
    const actors = [
      users.admin,
      ...(financeKeys.has(key) ? [users.finance] : []),
      ...(supportKeys.has(key) ? [users.support] : []),
      ...(examinerKeys.has(key) ? [users.examiner] : []),
      ...(verifierKeys.has(key) ? [users.verifier] : []),
    ];
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
  ['lang-es', 'es', 'اسپانیایی', 'Spanish', 'Español', '🇪🇸', 'LTR', 30, 'CEFR'],
  ['lang-tr', 'tr', 'ترکی', 'Turkish', 'Türkçe', '🇹🇷', 'LTR', 40, 'CEFR'],
  ['lang-fr', 'fr', 'فرانسوی', 'French', 'Français', '🇫🇷', 'LTR', 50, 'CEFR'],
  ['lang-it', 'it', 'ایتالیایی', 'Italian', 'Italiano', '🇮🇹', 'LTR', 60, 'CEFR'],
  ['lang-pt', 'pt', 'پرتغالی', 'Portuguese', 'Português', '🇵🇹', 'LTR', 70, 'CEFR'],
  ['lang-ko', 'ko', 'کره‌ای', 'Korean', '한국어', '🇰🇷', 'LTR', 80, 'CUSTOM'],
  ['lang-ar', 'ar', 'عربی', 'Arabic', 'العربية', '🇸🇦', 'RTL', 90, 'CEFR'],
  ['lang-ru', 'ru', 'روسی', 'Russian', 'Русский', '🇷🇺', 'LTR', 100, 'CEFR'],
] as const;

async function seedLanguages() {
  for (const [id, code, nameFa, nameEn, nativeName, flag, direction, order, proficiencySystem] of languageRows) {
    await db.language.upsert({
      where: { code },
      create: { id, code, nameFa, nameEn, nativeName, flag, direction, order, proficiencySystem, active: true },
      update: { nameFa, nameEn, nativeName, flag, direction, order, proficiencySystem, active: true },
    });
  }
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

  const teacherRows = [
    {
      id: 'teacher-sara',
      userId: users.approvedTeacher.id,
      slug: 'sara-dadkhah',
      nameFa: 'سارا دادخواه',
      nameEn: 'Sara Dadkhah',
      bioFa: 'مدرس تأییدشده انگلیسی با تمرکز بر رایتینگ و اسپیکینگ.',
      bioEn: 'Verified English teacher focused on writing and speaking.',
      gender: 'female',
      specialties: ['writing', 'speaking'],
      languages: ['English'],
      levels: ['B1', 'B2', 'C1'],
      languageId: 'lang-en',
      status: TeacherStatus.APPROVED,
      priceStatus: PriceStatus.APPROVED,
      proposedTrialPrice: 290_000,
      proposedRegularPrice: 690_000,
      approvedTrialPrice: 290_000,
      approvedRegularPrice: 690_000,
    },
    {
      id: 'teacher-arman',
      userId: users.germanTeacher.id,
      slug: 'arman-nikroush',
      nameFa: 'آرمان نیک‌روش',
      nameEn: 'Arman Nikroush',
      bioFa: 'مدرس تأییدشده آلمانی برای سطوح A1 تا B2.',
      bioEn: 'Verified German teacher for levels A1 through B2.',
      gender: 'male',
      specialties: ['conversation', 'grammar'],
      languages: ['Deutsch'],
      levels: ['A1', 'A2', 'B1', 'B2'],
      languageId: 'lang-de',
      status: TeacherStatus.APPROVED,
      priceStatus: PriceStatus.APPROVED,
      proposedTrialPrice: 260_000,
      proposedRegularPrice: 620_000,
      approvedTrialPrice: 260_000,
      approvedRegularPrice: 620_000,
    },
    {
      id: 'teacher-niloofar',
      userId: users.pendingTeacher.id,
      slug: 'niloofar-azari',
      nameFa: 'نیلوفر آذری',
      nameEn: 'Niloofar Azari',
      bioFa: 'متقاضی تدریس زبان ترکی و انگلیسی.',
      bioEn: 'Teacher applicant for Turkish and English.',
      gender: 'female',
      specialties: ['conversation'],
      languages: ['Türkçe'],
      levels: ['A1', 'A2'],
      languageId: 'lang-tr',
      status: TeacherStatus.DOCUMENT_REVIEW,
      priceStatus: PriceStatus.SUBMITTED,
      proposedTrialPrice: 220_000,
      proposedRegularPrice: 540_000,
      approvedTrialPrice: null,
      approvedRegularPrice: null,
    },
  ] as const;

  for (const row of teacherRows) {
    await db.teacher.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        userId: row.userId,
        slug: row.slug,
        nameFa: row.nameFa,
        nameEn: row.nameEn,
        bioFa: row.bioFa,
        bioEn: row.bioEn,
        status: row.status,
        gender: row.gender,
        experienceYears: 7,
        trialPrice: row.proposedTrialPrice,
        regularPrice: row.proposedRegularPrice,
        trialDuration: 30,
        lessonDuration: 60,
        breakMinutes: 15,
        proposedTrialPrice: row.proposedTrialPrice,
        proposedRegularPrice: row.proposedRegularPrice,
        approvedTrialPrice: row.approvedTrialPrice,
        approvedRegularPrice: row.approvedRegularPrice,
        priceStatus: row.priceStatus,
        priceReviewedById: row.priceStatus === PriceStatus.APPROVED ? users.admin.id : null,
        priceReviewedAt: row.priceStatus === PriceStatus.APPROVED ? now : null,
        specialties: [...row.specialties],
        languages: [...row.languages],
        targetBands: row.languageId === 'lang-en' ? [6.5, 7, 7.5, 8] : [],
        policyId: policy.id,
        submittedAt: at(-20, 9),
        approvedAt: row.status === TeacherStatus.APPROVED ? at(-15, 10) : null,
      },
      update: {
        userId: row.userId,
        nameFa: row.nameFa,
        nameEn: row.nameEn,
        bioFa: row.bioFa,
        bioEn: row.bioEn,
        status: row.status,
        gender: row.gender,
        proposedTrialPrice: row.proposedTrialPrice,
        proposedRegularPrice: row.proposedRegularPrice,
        approvedTrialPrice: row.approvedTrialPrice,
        approvedRegularPrice: row.approvedRegularPrice,
        priceStatus: row.priceStatus,
        specialties: [...row.specialties],
        languages: [...row.languages],
        policyId: policy.id,
      },
    });
    await db.teacherLanguage.upsert({
      where: { teacherId_languageId: { teacherId: row.id, languageId: row.languageId } },
      create: {
        teacherId: row.id,
        languageId: row.languageId,
        levels: [...row.levels],
        specialties: [...row.specialties],
        active: true,
      },
      update: { levels: [...row.levels], specialties: [...row.specialties], active: true },
    });
    await db.teacherPriceHistory.upsert({
      where: { id: `price-history-${row.id}` },
      create: {
        id: `price-history-${row.id}`,
        teacherId: row.id,
        actorId: row.priceStatus === PriceStatus.APPROVED ? users.admin.id : row.userId,
        actorRole: row.priceStatus === PriceStatus.APPROVED ? Role.ADMIN : Role.INSTRUCTOR,
        action: row.priceStatus === PriceStatus.APPROVED ? 'FINAL_APPROVED' : 'PROPOSED',
        status: row.priceStatus,
        proposedTrialPrice: row.proposedTrialPrice,
        proposedRegularPrice: row.proposedRegularPrice,
        approvedTrialPrice: row.approvedTrialPrice,
        approvedRegularPrice: row.approvedRegularPrice,
      },
      update: {
        status: row.priceStatus,
        proposedTrialPrice: row.proposedTrialPrice,
        proposedRegularPrice: row.proposedRegularPrice,
      },
    });

    for (const weekday of [0, 1, 2, 3, 4, 5]) {
      await db.availabilityRule.upsert({
        where: { id: `rule-${row.id}-${weekday}` },
        create: {
          id: `rule-${row.id}-${weekday}`,
          teacherId: row.id,
          weekday,
          startMinute: 540,
          endMinute: 1260,
          timezone: 'Asia/Tehran',
          lessonDuration: 60,
          breakMinutes: 15,
          active: true,
        },
        update: {
          startMinute: 540,
          endMinute: 1260,
          timezone: 'Asia/Tehran',
          lessonDuration: 60,
          breakMinutes: 15,
          active: true,
        },
      });
    }
  }

  const files = [
    {
      id: 'file-teacher-id',
      ownerId: users.approvedTeacher.id,
      key: 'seed/teacher-id.pdf',
      originalName: 'identity.pdf',
      mimeType: 'application/pdf',
      size: 120_000,
      checksum: 'seed-teacher-id',
      purpose: 'teacher_document',
    },
    {
      id: 'file-teacher-video',
      ownerId: users.approvedTeacher.id,
      key: 'seed/intro.mp4',
      originalName: 'intro.mp4',
      mimeType: 'video/mp4',
      size: 1_200_000,
      checksum: 'seed-teacher-video',
      purpose: 'teacher_intro',
    },
    {
      id: 'file-pending-certificate',
      ownerId: users.pendingTeacher.id,
      key: 'seed/certificate.pdf',
      originalName: 'certificate.pdf',
      mimeType: 'application/pdf',
      size: 210_000,
      checksum: 'seed-pending-certificate',
      purpose: 'teacher_document',
    },
  ];
  for (const file of files)
    await db.storedFile.upsert({
      where: { id: file.id },
      create: { ...file, status: 'SAFE' },
      update: { status: 'SAFE' },
    });

  await db.verificationItem.upsert({
    where: { id: 'verification-approved-id' },
    create: {
      id: 'verification-approved-id',
      teacherId: 'teacher-sara',
      kind: 'IDENTITY',
      fileId: 'file-teacher-id',
      status: DocumentStatus.APPROVED,
      reviewedById: users.verifier.id,
      reviewedAt: at(-15, 10),
      submittedAt: at(-20, 9),
    },
    update: { status: DocumentStatus.APPROVED, fileId: 'file-teacher-id', reviewedById: users.verifier.id },
  });
  await db.verificationItem.upsert({
    where: { id: 'verification-pending-certificate' },
    create: {
      id: 'verification-pending-certificate',
      teacherId: 'teacher-niloofar',
      kind: 'CERTIFICATE',
      fileId: 'file-pending-certificate',
      status: DocumentStatus.NEEDS_REVISION,
      reviewedById: users.verifier.id,
      reviewedAt: at(-1, 10),
      rejectionReason: 'تصویر مهر مؤسسه خوانا نیست؛ نسخه واضح‌تر بارگذاری کنید.',
      submittedAt: at(-3, 9),
    },
    update: {
      status: DocumentStatus.NEEDS_REVISION,
      rejectionReason: 'تصویر مهر مؤسسه خوانا نیست؛ نسخه واضح‌تر بارگذاری کنید.',
    },
  });

  await db.blockedPeriod.upsert({
    where: { id: 'block-teacher-sara' },
    create: {
      id: 'block-teacher-sara',
      teacherId: 'teacher-sara',
      startsAt: at(3, 8),
      endsAt: at(3, 10),
      reason: 'جلسه شخصی',
    },
    update: { startsAt: at(3, 8), endsAt: at(3, 10), reason: 'جلسه شخصی' },
  });
}

async function seedPackages() {
  const rows = [
    {
      id: 'package-sara-5',
      teacherId: 'teacher-sara',
      titleFa: 'بسته ۵ جلسه‌ای انگلیسی',
      titleEn: '5-session English package',
      descriptionFa: 'پنج جلسه خصوصی برای تقویت مکالمه و رایتینگ.',
      descriptionEn: 'Five private lessons focused on conversation and writing.',
      credits: 5,
      lessonMinutes: 60,
      listPrice: 3_450_000,
      discountPercent: 5,
      price: 3_277_500,
    },
    {
      id: 'package-arman-5',
      teacherId: 'teacher-arman',
      titleFa: 'بسته ۵ جلسه‌ای آلمانی',
      titleEn: '5-session German package',
      descriptionFa: 'پنج جلسه خصوصی زبان آلمانی از سطح A1 تا B2.',
      descriptionEn: 'Five private German lessons for levels A1 through B2.',
      credits: 5,
      lessonMinutes: 60,
      listPrice: 3_100_000,
      discountPercent: 5,
      price: 2_945_000,
    },
  ];
  for (const row of rows) {
    await db.package.upsert({
      where: { id: row.id },
      create: { ...row, approvalStatus: 'APPROVED', approvedById: users.admin.id, active: true },
      update: {
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

async function seedBookingsFinanceAndReviews() {
  const completed = await db.booking.upsert({
    where: { id: 'booking-completed-eligible' },
    create: {
      id: 'booking-completed-eligible',
      studentId: users.completedStudent.id,
      teacherId: 'teacher-sara',
      startsAt: at(-10, 9),
      endsAt: at(-10, 10),
      timezone: 'Asia/Tehran',
      type: 'regular',
      status: BookingStatus.COMPLETED,
      price: 690_000,
      policySnapshot: {},
      attendanceStudent: true,
      attendanceTeacher: true,
      meetingUrl: 'https://meet.local/completed',
    },
    update: { status: BookingStatus.COMPLETED, attendanceStudent: true, attendanceTeacher: true },
  });
  const paid = await db.booking.upsert({
    where: { id: 'booking-completed-paid' },
    create: {
      id: 'booking-completed-paid',
      studentId: users.completedStudent.id,
      teacherId: 'teacher-sara',
      startsAt: at(-24, 9),
      endsAt: at(-24, 10),
      timezone: 'Asia/Tehran',
      type: 'regular',
      status: BookingStatus.COMPLETED,
      price: 690_000,
      policySnapshot: {},
      attendanceStudent: true,
      attendanceTeacher: true,
    },
    update: { status: BookingStatus.COMPLETED, attendanceStudent: true, attendanceTeacher: true },
  });
  const future = await db.booking.upsert({
    where: { id: 'booking-future-confirmed' },
    create: {
      id: 'booking-future-confirmed',
      studentId: users.futureStudent.id,
      teacherId: 'teacher-arman',
      startsAt: at(5, 12),
      endsAt: at(5, 13),
      timezone: 'Asia/Tehran',
      type: 'trial',
      status: BookingStatus.CONFIRMED,
      price: 260_000,
      policySnapshot: {},
      meetingUrl: 'https://meet.local/future',
    },
    update: { startsAt: at(5, 12), endsAt: at(5, 13), status: BookingStatus.CONFIRMED },
  });
  await db.booking.upsert({
    where: { id: 'booking-cancelled' },
    create: {
      id: 'booking-cancelled',
      studentId: users.ticketStudent.id,
      teacherId: 'teacher-sara',
      startsAt: at(-4, 12),
      endsAt: at(-4, 13),
      timezone: 'Asia/Tehran',
      type: 'trial',
      status: BookingStatus.CANCELLED,
      price: 290_000,
      policySnapshot: {},
      cancelledAt: at(-5, 10),
      cancellationReason: 'لغو توسط زبان‌آموز',
    },
    update: { status: BookingStatus.CANCELLED, cancellationReason: 'لغو توسط زبان‌آموز' },
  });

  for (const booking of [completed, paid, future])
    await db.payment.upsert({
      where: { id: `payment-${booking.id}` },
      create: {
        id: `payment-${booking.id}`,
        bookingId: booking.id,
        userId: booking.studentId,
        purpose: 'BOOKING',
        referenceId: booking.id,
        subtotal: booking.price,
        gatewayAmount: booking.price,
        amount: booking.price,
        status: PaymentStatus.PAID,
        idempotencyKey: `seed-payment-${booking.id}`,
        gatewayReference: `seed-${booking.id}`,
        verifiedAt: now,
      },
      update: { status: PaymentStatus.PAID, amount: booking.price, verifiedAt: now },
    });

  const eligible = await db.earning.upsert({
    where: { bookingId: completed.id },
    create: {
      id: 'earning-eligible',
      teacherId: completed.teacherId,
      bookingId: completed.id,
      grossAmount: completed.price,
      commissionAmount: 103_500,
      netAmount: 586_500,
      status: EarningStatus.ELIGIBLE,
      eligibleAt: at(-9, 0),
    },
    update: {
      status: EarningStatus.ELIGIBLE,
      grossAmount: completed.price,
      commissionAmount: 103_500,
      netAmount: 586_500,
    },
  });
  const paidEarning = await db.earning.upsert({
    where: { bookingId: paid.id },
    create: {
      id: 'earning-paid',
      teacherId: paid.teacherId,
      bookingId: paid.id,
      grossAmount: paid.price,
      commissionAmount: 103_500,
      netAmount: 586_500,
      status: EarningStatus.PAID,
      eligibleAt: at(-23, 0),
    },
    update: { status: EarningStatus.PAID },
  });
  const payout = await db.payoutBatch.upsert({
    where: { id: 'payout-previous' },
    create: {
      id: 'payout-previous',
      weekStart: at(-28, 0),
      weekEnd: at(-21, 23),
      status: PayoutStatus.TRANSFERRED,
      totalAmount: 586_500,
      approvedById: users.admin.id,
      approvedAt: at(-20, 10),
      transferredAt: at(-19, 10),
      reference: 'SEED-PAYOUT-001',
    },
    update: { status: PayoutStatus.TRANSFERRED, totalAmount: 586_500 },
  });
  await db.payoutItem.upsert({
    where: { earningId: paidEarning.id },
    create: {
      id: 'payout-item-paid',
      batchId: payout.id,
      earningId: paidEarning.id,
      teacherId: paidEarning.teacherId,
      amount: paidEarning.netAmount,
    },
    update: { batchId: payout.id, amount: paidEarning.netAmount },
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
    update: { rating: 5, moderationStatus: ReviewStatus.APPROVED, published: true, moderatedById: users.admin.id },
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

  void eligible;
}

async function seedDemoExperience() {
  const student = users.demoStudent;
  const policy = await db.cancellationPolicy.findUniqueOrThrow({ where: { id: 'policy-flexible' } });
  const demoTeachers = [
    [
      'ava',
      'آوا مرادی',
      'Ava Moradi',
      'female',
      'lang-en',
      'English',
      ['IELTS', 'speaking'],
      ['B1', 'B2', 'C1'],
      320000,
      760000,
      4.9,
    ],
    [
      'pouya',
      'پویا شریفی',
      'Pouya Sharifi',
      'male',
      'lang-en',
      'English',
      ['IELTS', 'writing'],
      ['B2', 'C1'],
      350000,
      820000,
      4.8,
    ],
    [
      'leila',
      'لیلا زمانی',
      'Leila Zamani',
      'female',
      'lang-de',
      'Deutsch',
      ['conversation', 'grammar'],
      ['A1', 'A2', 'B1'],
      270000,
      640000,
      4.7,
    ],
    [
      'navid',
      'نوید رستگار',
      'Navid Rastegar',
      'male',
      'lang-fr',
      'Français',
      ['conversation', 'DELF'],
      ['A1', 'A2', 'B1', 'B2'],
      280000,
      660000,
      4.6,
    ],
    [
      'shadi',
      'شادی فرهمند',
      'Shadi Farahmand',
      'female',
      'lang-es',
      'Español',
      ['conversation', 'DELE'],
      ['A1', 'A2', 'B1'],
      250000,
      590000,
      4.9,
    ],
    [
      'amirali',
      'امیرعلی توکلی',
      'Amirali Tavakoli',
      'male',
      'lang-tr',
      'Türkçe',
      ['conversation', 'travel'],
      ['A1', 'A2', 'B1'],
      230000,
      540000,
      4.5,
    ],
    [
      'yuna',
      'یونا کیم',
      'Yuna Kim',
      'female',
      'lang-ko',
      '한국어',
      ['TOPIK', 'conversation'],
      ['Beginner', 'Intermediate'],
      300000,
      710000,
      4.9,
    ],
    [
      'marco',
      'مارکو رضایی',
      'Marco Rezaei',
      'male',
      'lang-it',
      'Italiano',
      ['conversation', 'CILS'],
      ['A1', 'A2', 'B1'],
      260000,
      610000,
      4.7,
    ],
    [
      'elena',
      'النا کریمی',
      'Elena Karimi',
      'female',
      'lang-ru',
      'Русский',
      ['conversation', 'grammar'],
      ['A1', 'A2', 'B1'],
      275000,
      650000,
      4.8,
    ],
    [
      'samir',
      'سمیر موسوی',
      'Samir Mousavi',
      'male',
      'lang-ar',
      'العربية',
      ['conversation', 'business'],
      ['A1', 'A2', 'B1', 'B2'],
      240000,
      570000,
      4.6,
    ],
  ] as const;
  for (let index = 0; index < demoTeachers.length; index += 1) {
    const [key, nameFa, nameEn, gender, languageId, nativeName, specialties, levels, trial, regular, rating] =
      demoTeachers[index]!;
    const userId = `user-teacher-demo-${key}`,
      teacherId = `teacher-demo-${key}`,
      phone = e164(`091300001${String(index).padStart(2, '0')}`);
    await db.user.upsert({
      where: { phone },
      create: {
        id: userId,
        phone,
        name: nameFa,
        email: `${key}@demo.local`,
        profileComplete: true,
        locale: 'fa',
        timezone: 'Asia/Tehran',
      },
      update: { name: nameFa, status: 'ACTIVE' },
    });
    await db.userRole.upsert({
      where: { userId_role: { userId, role: Role.INSTRUCTOR } },
      create: { userId, role: Role.INSTRUCTOR },
      update: {},
    });
    await db.teacher.upsert({
      where: { id: teacherId },
      create: {
        id: teacherId,
        userId,
        slug: `demo-${key}`,
        nameFa,
        nameEn,
        bioFa: `مدرس حرفه‌ای ${nativeName} با برنامه آموزشی شخصی‌سازی‌شده و تجربه کلاس آنلاین.`,
        bioEn: `Professional ${nativeName} teacher with personalized online lessons.`,
        status: TeacherStatus.APPROVED,
        rating,
        reviewsCount: 18 + index * 7,
        experienceYears: 4 + (index % 6),
        gender,
        trialPrice: trial,
        regularPrice: regular,
        trialDuration: 30,
        lessonDuration: 60,
        approvedTrialPrice: trial,
        approvedRegularPrice: regular,
        proposedTrialPrice: trial,
        proposedRegularPrice: regular,
        priceStatus: PriceStatus.APPROVED,
        priceReviewedById: users.admin.id,
        priceReviewedAt: at(-30, 9),
        specialties: [...specialties],
        languages: [nativeName],
        targetBands: languageId === 'lang-en' ? [6.5, 7, 7.5, 8] : [],
        policyId: policy.id,
        submittedAt: at(-40, 9),
        approvedAt: at(-30, 9),
      },
      update: {
        status: TeacherStatus.APPROVED,
        rating,
        reviewsCount: 18 + index * 7,
        approvedTrialPrice: trial,
        approvedRegularPrice: regular,
        specialties: [...specialties],
        policyId: policy.id,
      },
    });
    await db.teacherLanguage.upsert({
      where: { teacherId_languageId: { teacherId, languageId } },
      create: { teacherId, languageId, levels: [...levels], specialties: [...specialties], active: true },
      update: { levels: [...levels], specialties: [...specialties], active: true },
    });
    for (const weekday of [0, 1, 2, 3, 4, 5])
      await db.availabilityRule.upsert({
        where: { id: `rule-${teacherId}-${weekday}` },
        create: {
          id: `rule-${teacherId}-${weekday}`,
          teacherId,
          weekday,
          startMinute: 540,
          endMinute: 1260,
          timezone: 'Asia/Tehran',
          lessonDuration: 60,
          breakMinutes: 0,
          active: true,
        },
        update: { active: true, startMinute: 540, endMinute: 1260 },
      });
  }

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
    [
      'test-demo-spanish',
      'spanish-demo-a2',
      'lang-es',
      'A2',
      'آزمون تعیین سطح اسپانیایی',
      'Spanish Placement Test',
      40,
    ],
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
    ['spanish', 'test-demo-spanish', 'Comprensión'],
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
    [
      'q-demo-spanish',
      'section-demo-spanish',
      'single_choice',
      'گزینه درست را انتخاب کنید.',
      'Choose the correct sentence.',
      ['Me llamo Carlos.', 'Yo llama Carlos.', 'Mi llamar Carlos.'],
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
    ['attempt-demo-spanish', 'test-demo-spanish', TestStatus.UNDER_REVIEW, undefined, -2],
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
  for (let rank = 1; rank <= 10; rank += 1) {
    const key = demoTeachers[rank - 1]![0];
    await db.matchingRecommendation.upsert({
      where: { sessionId_rank: { sessionId: session.id, rank } },
      create: {
        sessionId: session.id,
        teacherId: `teacher-demo-${key}`,
        rank,
        score: 96 - rank * 2,
        reasons: { fa: ['هماهنگ با بودجه و زمان شما', 'تجربه تدریس آنلاین'], en: ['Matches your budget and schedule'] },
        audit: { compatibleSlots: 12 - (rank % 4), price: demoTeachers[rank - 1]![8] },
      },
      update: { teacherId: `teacher-demo-${key}`, score: 96 - rank * 2 },
    });
  }

  const bookings = [
    ['booking-demo-completed', 'teacher-demo-ava', -8, BookingStatus.COMPLETED, 760000],
    ['booking-demo-upcoming', 'teacher-demo-pouya', 3, BookingStatus.CONFIRMED, 350000],
    ['booking-demo-upcoming-2', 'teacher-demo-leila', 7, BookingStatus.CONFIRMED, 270000],
  ] as const;
  for (const [id, teacherId, days, status, price] of bookings) {
    const booking = await db.booking.upsert({
      where: { id },
      create: {
        id,
        studentId: student.id,
        teacherId,
        startsAt: at(days, 14),
        endsAt: at(days, 15),
        timezone: 'Asia/Tehran',
        type: id.includes('completed') ? 'regular' : 'trial',
        status,
        price,
        policySnapshot: { title: 'flexible' },
        meetingUrl: `https://meet.jit.si/lingospeak-${id}`,
        attendanceStudent: status === BookingStatus.COMPLETED ? true : null,
        attendanceTeacher: status === BookingStatus.COMPLETED ? true : null,
      },
      update: { startsAt: at(days, 14), endsAt: at(days, 15), status },
    });
    await db.payment.upsert({
      where: { id: `payment-${id}` },
      create: {
        id: `payment-${id}`,
        bookingId: booking.id,
        userId: student.id,
        purpose: 'BOOKING',
        referenceId: booking.id,
        subtotal: price,
        discountAmount: id.includes('completed') ? 76000 : 0,
        walletAmount: id.includes('completed') ? 200000 : 0,
        gatewayAmount: id.includes('completed') ? 484000 : price,
        amount: id.includes('completed') ? 684000 : price,
        status: PaymentStatus.PAID,
        idempotencyKey: `seed-demo-${id}`,
        gatewayReference: `LS-DEMO-${1000 + days}`,
        verifiedAt: at(days - 1, 12),
      },
      update: { status: PaymentStatus.PAID, verifiedAt: at(days - 1, 12) },
    });
  }
  const ledger = [
    ['topup-1', 'CREDIT', 2500000, 'افزایش موجودی از درگاه پرداخت', 'TopUp', 'wallet-topup-demo-1', -20],
    ['class-1', 'DEBIT', 200000, 'پرداخت بخشی از هزینه کلاس IELTS', 'Payment', 'payment-booking-demo-completed', -9],
    ['gift-1', 'CREDIT', 300000, 'اعتبار هدیه خوش‌آمدگویی', 'Gift', 'welcome-demo', -6],
    ['refund-1', 'CREDIT', 180000, 'بازگشت وجه جلسه لغوشده', 'Refund', 'refund-demo', -4],
    ['reserve-1', 'DEBIT', 350000, 'رزرو جلسه آزمایشی آینده', 'Payment', 'payment-booking-demo-upcoming', -1],
  ] as const;
  for (const [id, direction, amount, description, referenceType, referenceId, days] of ledger)
    await db.walletEntry.upsert({
      where: { idempotencyKey: `seed-demo-ledger-${id}` },
      create: {
        id: `wallet-demo-${id}`,
        userId: student.id,
        transactionId: `TX-DEMO-${id.toUpperCase()}`,
        account: 'user_wallet',
        direction,
        amount,
        description,
        referenceType,
        referenceId,
        idempotencyKey: `seed-demo-ledger-${id}`,
        createdAt: at(days, 12),
      },
      update: { amount, description },
    });
  await db.learningPlan.upsert({
    where: { id: 'plan-demo-ielts' },
    create: {
      id: 'plan-demo-ielts',
      studentId: student.id,
      teacherId: 'teacher-demo-ava',
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
    update: { title: 'مسیر آمادگی IELTS Academic نمره ۷٫۵', targetBand: 7.5, status: 'active' },
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

  await db.setting.upsert({
    where: { key: 'support.phone' },
    create: {
      key: 'support.phone',
      value: { number: '02191094200', hoursFa: 'شنبه تا پنج‌شنبه، ۹ تا ۲۰', hoursEn: 'Saturday–Thursday, 9–20' },
      public: true,
    },
    update: { public: true },
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

  const pages = [
    {
      slug: 'about',
      titleFa: 'درباره ما',
      titleEn: 'About us',
      contentFa: {
        paragraphs: [
          'لینگواسپیک برای ساده‌کردن مسیر پیدا کردن مدرس زبان ساخته شده است. ما مدرس‌ها را بررسی می‌کنیم، امکان تعیین سطح و مقایسه شفاف را فراهم می‌کنیم و به زبان‌آموز کمک می‌کنیم کلاس مناسب هدف، بودجه و زمان خود را پیدا کند.',
        ],
      },
      contentEn: {
        paragraphs: [
          'LingoSpeak makes finding the right language teacher simpler. We verify teachers, provide language-specific assessments and transparent comparisons, and help learners book classes that fit their goals, budget and schedule.',
        ],
      },
    },
    {
      slug: 'how-it-works',
      titleFa: 'نحوه کار',
      titleEn: 'How it works',
      contentFa: { paragraphs: ['زبان را انتخاب کنید، سطح خود را بسنجید و مدرس مناسب را رزرو کنید.'] },
      contentEn: { paragraphs: ['Choose a language, assess your level, and book the right teacher.'] },
    },
    {
      slug: 'faq',
      titleFa: 'سؤالات متداول',
      titleEn: 'FAQ',
      contentFa: { paragraphs: ['پاسخ سؤالات متداول از پنل مدیریت قابل ویرایش است.'] },
      contentEn: { paragraphs: ['Frequently asked questions are editable from the admin panel.'] },
    },
    // The footer links to /terms, /privacy and /contact on every page, and the
    // booking flow references the cancellation policy — but none of these were
    // seeded, so all of them returned 404. They are also an Enamad prerequisite.
    //
    // TODO(legal): this is a working baseline, not vetted legal text. Have it
    // reviewed before launch, and replace every «...» placeholder — the company
    // registration details are not derivable from the codebase.
    {
      slug: 'contact',
      titleFa: 'تماس با ما',
      titleEn: 'Contact us',
      contentFa: {
        paragraphs: [
          'پشتیبانی لینگواسپیک شنبه تا پنج‌شنبه از ساعت ۹ تا ۲۰ پاسخگوی شماست.',
          'تلفن پشتیبانی: ۰۲۱۹۱۰۹۴۲۰۰',
          'رایانامه: support@lingospeak.ir',
          'نشانی: «نشانی کامل شرکت را وارد کنید»',
          'شناسه ملی / شماره ثبت: «شماره ثبت را وارد کنید»',
          'برای پیگیری سفارش، رزرو یا پرداخت، از بخش «تیکت پشتیبانی» در پنل کاربری خود استفاده کنید تا درخواست شما ثبت و قابل پیگیری باشد.',
        ],
      },
      contentEn: {
        paragraphs: [
          'LingoSpeak support is available Saturday to Thursday, 9:00 to 20:00.',
          'Phone: +98 21 9109 4200',
          'Email: support@lingospeak.ir',
          'Address: «enter the full company address»',
          'Company registration number: «enter the registration number»',
          'To follow up on a booking or payment, open a support ticket from your dashboard so your request is recorded and traceable.',
        ],
      },
    },
    {
      slug: 'terms',
      titleFa: 'قوانین و مقررات',
      titleEn: 'Terms of use',
      contentFa: {
        paragraphs: [
          'با ثبت‌نام و استفاده از لینگواسپیک، شما این قوانین را می‌پذیرید. لینگواسپیک بستری برای اتصال زبان‌آموز و مدرس زبان است و کلاس‌ها به‌صورت آنلاین و از طریق همین سامانه برگزار می‌شود.',
          'ثبت‌نام و ورود با شماره تلفن همراه و کد یک‌بارمصرف انجام می‌شود. مسئولیت حفظ دسترسی به شماره تلفن و حساب کاربری بر عهده کاربر است.',
          'مدرسان پیش از انتشار پروفایل عمومی، از نظر مدارک، سابقه و ویدیوی معرفی بررسی و تأیید می‌شوند. قیمت هر مدرس نیز پیش از انتشار توسط تیم لینگواسپیک بررسی و تأیید می‌شود.',
          'برای رزرو کلاس عادی با هر مدرس، ابتدا برگزاری یک جلسه آزمایشی با همان مدرس الزامی است. قیمت جلسه آزمایشی نصف قیمت جلسه عادی است و هر زبان‌آموز با هر مدرس یک‌بار می‌تواند از آن استفاده کند.',
          'مبلغ پرداختی زبان‌آموز تا زمان برگزاری و تکمیل کلاس توسط لینگواسپیک نگهداری می‌شود و پس از آن سهم مدرس، پس از کسر کمیسیون سامانه، به کیف پول او واریز می‌گردد.',
          'جابه‌جایی زمان کلاس تنها با توافق هر دو طرف و از طریق همین سامانه امکان‌پذیر است. لغو کلاس تابع سیاست لغو و بازپرداخت است که در زمان رزرو به تأیید شما می‌رسد.',
          'رد و بدل کردن شماره تلفن، نشانی یا اطلاعات تماس شخصی برای برگزاری کلاس خارج از سامانه مجاز نیست و می‌تواند به تعلیق حساب کاربری منجر شود.',
          'نظرات زبان‌آموزان پیش از انتشار توسط تیم پشتیبانی بررسی می‌شود. انتشار محتوای توهین‌آمیز، تبلیغاتی یا نامرتبط مجاز نیست.',
          'لینگواسپیک می‌تواند در صورت تکرار نظرات بسیار منفی یا نقض مکرر قوانین، حساب یک مدرس را غیرفعال کند.',
          'این قوانین ممکن است به‌روزرسانی شود و نسخه جاری همیشه در همین صفحه در دسترس است.',
        ],
      },
      contentEn: {
        paragraphs: [
          'By registering and using LingoSpeak you accept these terms. LingoSpeak is a platform that connects language learners with teachers; lessons are delivered online through this platform.',
          'Registration and sign-in use your mobile number and a one-time code. You are responsible for keeping access to that number and your account secure.',
          "Teachers are reviewed for documents, experience and an introduction video before their public profile goes live. Each teacher's price is also reviewed and approved by the LingoSpeak team before publication.",
          'Before booking a regular lesson with a teacher, you must first take a trial session with that teacher. The trial is half the price of a regular lesson and is available once per learner-teacher pair.',
          "Payments are held by LingoSpeak until the lesson has taken place and been completed. The teacher's share, net of the platform commission, is then credited to their wallet.",
          'Rescheduling requires both parties to agree and must be arranged through this platform. Cancellations are governed by the cancellation and refund policy you accept when booking.',
          'Exchanging phone numbers, addresses or other personal contact details in order to hold lessons outside the platform is not permitted and may lead to account suspension.',
          'Learner reviews are checked by the support team before publication. Abusive, promotional or irrelevant content will not be published.',
          "LingoSpeak may deactivate a teacher's account after repeated very negative reviews or repeated breaches of these terms.",
          'These terms may be updated; the current version is always available on this page.',
        ],
      },
    },
    {
      slug: 'privacy',
      titleFa: 'سیاست حفظ حریم خصوصی',
      titleEn: 'Privacy policy',
      contentFa: {
        paragraphs: [
          'لینگواسپیک تنها اطلاعاتی را جمع‌آوری می‌کند که برای ارائه خدمات لازم است: شماره تلفن همراه، نام، نشانی رایانامه (اختیاری)، تاریخ تولد (اختیاری، برای تخفیف تولد)، منطقه زمانی و زبان مورد نظر شما.',
          'شماره تلفن شما برای ورود به حساب، ارسال کد یک‌بارمصرف و اطلاع‌رسانی درباره کلاس‌ها استفاده می‌شود.',
          'تاریخ تولد تنها برای اعمال خودکار تخفیف تولد استفاده می‌شود و در پروفایل عمومی نمایش داده نمی‌شود.',
          'اطلاعات پرداخت شما نزد درگاه پرداخت پردازش می‌شود؛ لینگواسپیک اطلاعات کارت بانکی شما را دریافت یا ذخیره نمی‌کند.',
          'مدارک بارگذاری‌شده توسط مدرسان تنها برای فرایند تأیید صلاحیت و توسط تیم بررسی لینگواسپیک مشاهده می‌شود.',
          'اطلاعات شما بدون رضایت شما در اختیار اشخاص ثالث قرار نمی‌گیرد، مگر در مواردی که قانون یا مراجع قضایی الزام کند.',
          'برای حذف حساب کاربری یا درخواست اطلاعات ذخیره‌شده خود، از طریق صفحه تماس با ما یا تیکت پشتیبانی درخواست دهید.',
        ],
      },
      contentEn: {
        paragraphs: [
          'LingoSpeak collects only the information needed to provide the service: your mobile number, name, email address (optional), date of birth (optional, for the birthday discount), timezone and the language you want to learn.',
          'Your phone number is used to sign in, to send one-time codes, and to notify you about your lessons.',
          'Your date of birth is used only to apply the automatic birthday discount and is never shown on your public profile.',
          'Payment details are processed by the payment gateway. LingoSpeak does not receive or store your bank card details.',
          'Documents uploaded by teachers are visible only to the LingoSpeak verification team, and only for the purpose of that verification.',
          'We do not share your information with third parties without your consent, except where required by law.',
          'To delete your account or request a copy of your stored data, contact us through the contact page or a support ticket.',
        ],
      },
    },
    {
      slug: 'cancellation-policy',
      titleFa: 'سیاست لغو و بازپرداخت',
      titleEn: 'Cancellation and refund policy',
      contentFa: {
        paragraphs: [
          'مبلغ پرداختی شما تا زمان برگزاری کلاس نزد لینگواسپیک نگهداری می‌شود، بنابراین بازپرداخت به‌صورت خودکار و بدون نیاز به پیگیری دستی انجام می‌شود.',
          'لغو کلاس تا پیش از بازه تعیین‌شده در سیاست لغو همان مدرس، مشمول بازپرداخت است. درصد بازپرداخت در زمان رزرو به شما نمایش داده می‌شود و همان مقدار برای رزرو شما ثبت و اعمال می‌گردد.',
          'مبلغ بازپرداخت به کیف پول شما در لینگواسپیک واریز می‌شود و می‌توانید از آن برای رزرو کلاس بعدی استفاده کنید.',
          'لغو دیرهنگام یا عدم حضور در کلاس، مشمول جریمه است و ممکن است بازپرداختی صورت نگیرد.',
          'اگر پرداخت شما پس از پایان مهلت پرداخت به سامانه برسد و نوبت آزاد شده باشد، کل مبلغ به‌طور خودکار به کیف پول شما بازگردانده می‌شود.',
          'در صورت لغو کلاس توسط مدرس یا بروز اختلاف، از طریق تیکت پشتیبانی درخواست خود را ثبت کنید؛ تیم پشتیبانی موضوع را بررسی و درباره بازپرداخت تصمیم‌گیری می‌کند.',
          'اگر کلاس با استفاده از اعتبار یک بسته آموزشی رزرو شده باشد، در صورت لغو مجاز، اعتبار جلسه به بسته شما بازگردانده می‌شود.',
        ],
      },
      contentEn: {
        paragraphs: [
          'Your payment is held by LingoSpeak until the lesson takes place, so refunds are issued automatically without manual follow-up.',
          "Cancelling before the window defined in your teacher's cancellation policy qualifies for a refund. The refund percentage is shown to you at booking time and that same figure is recorded against your booking and applied.",
          'Refunds are credited to your LingoSpeak wallet and can be used for your next booking.',
          'Late cancellation or not attending a lesson incurs a penalty and may not be refunded.',
          'If your payment reaches us after the payment window has closed and the slot has been released, the full amount is returned to your wallet automatically.',
          'If a teacher cancels, or a dispute arises, open a support ticket. The support team will review it and decide on a refund.',
          'When a lesson was booked using package credit, an eligible cancellation returns the lesson credit to your package.',
        ],
      },
    },
    {
      slug: 'become-a-teacher',
      titleFa: 'مدرس شوید',
      titleEn: 'Become a teacher',
      contentFa: {
        paragraphs: [
          'برای تدریس در لینگواسپیک، فرم درخواست را تکمیل کنید و زبان‌ها و سطوح تدریس، سابقه، مدارک و یک ویدیوی معرفی کوتاه را بارگذاری کنید.',
          'تیم لینگواسپیک مدارک شما را بررسی می‌کند. مدارک به‌صورت جداگانه راستی‌آزمایی می‌شوند و تنها پس از تأیید نهایی، پروفایل شما عمومی و قابل جستجو می‌شود.',
          'قیمت جلسه آزمایشی و عادی خود را پیشنهاد می‌دهید؛ تیم لینگواسپیک می‌تواند آن را تأیید کند یا قیمت متقابل پیشنهاد دهد. قیمت جلسه آزمایشی نصف قیمت جلسه عادی است.',
          'درآمد هر کلاس پس از برگزاری و تکمیل آن، با کسر کمیسیون سامانه، به کیف پول شما واریز می‌شود و در دوره‌های تسویه به حساب بانکی شما پرداخت می‌گردد.',
          'در صورت رد درخواست، دلیل آن به شما اعلام می‌شود و می‌توانید پس از رفع موارد اعلام‌شده دوباره درخواست دهید.',
        ],
      },
      contentEn: {
        paragraphs: [
          'To teach on LingoSpeak, complete the application form with the languages and levels you teach, your experience, your documents, and a short introduction video.',
          'The LingoSpeak team reviews your application. Documents are verified separately, and your profile becomes public and searchable only after final approval.',
          'You propose your trial and regular lesson prices; the team can approve them or make a counter-offer. The trial price is half the regular price.',
          'Earnings from each lesson are credited to your wallet after the lesson is completed, net of the platform commission, and paid out to your bank account in the settlement cycle.',
          'If your application is rejected you will be told why, and you can reapply once you have addressed the reasons given.',
        ],
      },
    },
  ];
  for (const page of pages)
    await db.cmsPage.upsert({
      where: { slug: page.slug },
      create: { ...page, seo: { description: page.titleFa }, published: true },
      // Content is deliberately not overwritten. `db:prepare` runs the seed, and
      // `start:api` runs `db:prepare`, so re-writing the body here reverted every
      // admin edit to the legal and CMS pages on each deploy. The seed's job is to
      // guarantee the page exists and is reachable; the admin panel owns the text
      // from then on.
      update: { published: true },
    });
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
      entityId: 'teacher-sara',
      after: { approvedTrialPrice: 290_000, approvedRegularPrice: 690_000 },
    },
    {
      actorId: users.verifier.id,
      action: 'teacher.document.needs_revision',
      entity: 'VerificationItem',
      entityId: 'verification-pending-certificate',
      after: { reason: 'Unreadable stamp' },
    },
    {
      actorId: users.support.id,
      action: 'ticket.assigned',
      entity: 'Ticket',
      entityId: 'ticket-assigned-open',
      after: { assignedToId: users.support.id },
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
  const productivity = await db.blogCategory.upsert({
    where: { slug: 'learning-tips' },
    update: {},
    create: { slug: 'learning-tips', nameFa: 'نکات یادگیری', nameEn: 'Learning tips' },
  });
  const culture = await db.blogCategory.upsert({
    where: { slug: 'culture' },
    update: {},
    create: { slug: 'culture', nameFa: 'فرهنگ و زبان', nameEn: 'Culture & language' },
  });
  const tags = await Promise.all(
    [
      ['speaking', 'مکالمه', 'Speaking'] as const,
      ['vocabulary', 'واژگان', 'Vocabulary'] as const,
      ['study-plan', 'برنامه‌ریزی', 'Study plan'] as const,
    ].map(([slug, nameFa, nameEn]) =>
      db.blogTag.upsert({ where: { slug }, update: {}, create: { slug, nameFa, nameEn } }),
    ),
  );
  const posts = [
    {
      slug: 'speak-with-confidence',
      categoryId: productivity.id,
      titleFa: 'چطور با اعتمادبه‌نفس انگلیسی صحبت کنیم؟',
      titleEn: 'How to speak English with confidence',
      excerptFa: 'تمرین‌های کوتاه و کاربردی برای عبور از ترس مکالمه.',
      excerptEn: 'Short practical exercises to overcome speaking anxiety.',
      contentFa:
        '# از اشتباه کردن نترسید\n\nمکالمه مهارتی است که با تمرین روزانه رشد می‌کند. هر روز پنج دقیقه درباره‌ی یک موضوع ساده صحبت کنید و صدای خود را ضبط کنید.',
      contentEn:
        '# Embrace mistakes\n\nSpeaking grows through daily practice. Talk for five minutes about a simple topic and record yourself.',
      tagIds: [tags[0]!.id, tags[2]!.id],
    },
    {
      slug: 'vocabulary-in-context',
      categoryId: productivity.id,
      titleFa: 'واژگان را در جمله یاد بگیرید',
      titleEn: 'Learn vocabulary in context',
      excerptFa: 'چرا حفظ کردن فهرست لغات کافی نیست و چه روشی بهتر جواب می‌دهد؟',
      excerptEn: 'Why word lists are not enough—and what works better.',
      contentFa:
        '## یک کلمه، سه جمله\n\nهر واژه‌ی جدید را در سه جمله‌ی واقعی به کار ببرید و روز بعد آن جمله‌ها را مرور کنید.',
      contentEn:
        '## One word, three sentences\n\nUse every new word in three real sentences and review them the next day.',
      tagIds: [tags[1]!.id],
    },
    {
      slug: 'english-through-films',
      categoryId: culture.id,
      titleFa: 'یادگیری زبان با فیلم و سریال',
      titleEn: 'Learn English through films',
      excerptFa: 'یک روش سه‌مرحله‌ای برای تبدیل تماشای فیلم به تمرین زبان.',
      excerptEn: 'A three-step method to turn movie time into language practice.',
      contentFa: '### روش سه‌مرحله‌ای\n\nابتدا با زیرنویس فارسی، سپس انگلیسی و در پایان بدون زیرنویس تماشا کنید.',
      contentEn:
        '### The three-step method\n\nWatch first with native subtitles, then English subtitles, and finally without subtitles.',
      tagIds: [tags[0]!.id, tags[1]!.id],
    },
  ];
  for (const p of posts)
    await db.blogPost.upsert({
      where: { slug: p.slug },
      update: { ...p, tagIds: undefined, status: BlogPostStatus.PUBLISHED, publishedAt: now },
      create: {
        ...p,
        tagIds: undefined,
        authorId: users.admin.id,
        status: BlogPostStatus.PUBLISHED,
        publishedAt: now,
        tags: { connect: p.tagIds!.map((id) => ({ id })) },
      },
    } as any);
}

async function seedCourses() {
  const rows = [
    {
      id: 'course-english-conversation',
      slug: 'english-conversation',
      titleFa: 'مکالمه روان انگلیسی',
      titleEn: 'Fluent English conversation',
      descriptionFa: 'مسیر تمرین‌محور مکالمه با بازخورد منظم و تمرین‌های واقعی.',
      descriptionEn: 'A practice-led speaking course with structured feedback.',
      language: 'انگلیسی',
      level: 'B1',
      teacherName: 'سارا دادخواه',
      teacherId: 'teacher-sara',
      lessonsCount: 16,
      price: 2_980_000,
      image: '/images/lingospeak-student.png',
    },
    {
      id: 'course-german-zero',
      slug: 'german-zero',
      titleFa: 'آلمانی از صفر تا مکالمه',
      titleEn: 'German from zero to conversation',
      descriptionFa: 'پایه‌های زبان آلمانی برای شروع مطمئن مکالمه روزمره.',
      descriptionEn: 'German foundations for confident everyday conversations.',
      language: 'آلمانی',
      level: 'A1',
      teacherName: 'آرمان نیک‌روش',
      teacherId: 'teacher-arman',
      lessonsCount: 20,
      price: 3_490_000,
      image: '/images/auth/register.png',
    },
    {
      id: 'course-french-travel',
      slug: 'french-travel',
      titleFa: 'فرانسوی برای سفر',
      titleEn: 'French for travel',
      descriptionFa: 'واژگان و موقعیت‌های ضروری برای یک سفر روان‌تر.',
      descriptionEn: 'Essential language and scenarios for smoother travel.',
      language: 'فرانسوی',
      level: 'A2',
      teacherName: 'تیم لینگواسپیک',
      teacherId: null,
      lessonsCount: 12,
      price: 2_490_000,
      image: '/images/auth/login.png',
    },
    {
      id: 'course-spanish-everyday',
      slug: 'spanish-everyday',
      titleFa: 'اسپانیایی برای زندگی روزمره',
      titleEn: 'Everyday Spanish',
      descriptionFa: 'مکالمه کاربردی برای موقعیت‌های واقعی زندگی روزانه.',
      descriptionEn: 'Practical conversations for everyday situations.',
      language: 'اسپانیایی',
      level: 'A2',
      teacherName: 'تیم لینگواسپیک',
      teacherId: null,
      lessonsCount: 14,
      price: 2_690_000,
      image: '/images/auth/forgot.png',
    },
  ];
  for (const row of rows)
    await db.course.upsert({
      where: { slug: row.slug },
      create: { ...row, published: true },
      update: { ...row, published: true },
    });
  const demoChapters = [
    { id: 'course-en-chapter-1', titleFa: 'شروع مکالمه‌های واقعی', titleEn: 'Starting real conversations', order: 1 },
    { id: 'course-en-chapter-2', titleFa: 'تعامل در زندگی روزمره', titleEn: 'Everyday interactions', order: 2 },
    { id: 'course-en-chapter-3', titleFa: 'روان‌گویی و جمع‌بندی', titleEn: 'Fluency and review', order: 3 },
  ];
  for (const chapter of demoChapters)
    await db.courseChapter.upsert({
      where: { id: chapter.id },
      create: { ...chapter, courseId: rows[0]!.id },
      update: { titleFa: chapter.titleFa, titleEn: chapter.titleEn, order: chapter.order, published: true },
    });
  const demoLessons = [
    [
      'course-en-lesson-1',
      demoChapters[0]!.id,
      'معرفی خود با اعتمادبه‌نفس',
      'Introducing yourself confidently',
      'VIDEO',
      1,
      720,
      {
        fa: 'در این درس الگوهای ساده معرفی خود را در یک گفت‌وگوی واقعی تمرین می‌کنیم.',
        en: 'Practise simple introduction patterns in a real conversation.',
      },
    ],
    [
      'course-en-lesson-2',
      demoChapters[0]!.id,
      'سؤال‌های کاربردی',
      'Useful questions',
      'TEXT',
      2,
      540,
      {
        fa: 'پرسش‌های باز و بسته را بسازید و پاسخ طبیعی بدهید.',
        en: 'Build open and closed questions and answer naturally.',
      },
    ],
    [
      'course-en-lesson-3',
      demoChapters[1]!.id,
      'سفارش در کافه',
      'Ordering at a café',
      'AUDIO',
      1,
      660,
      {
        fa: 'به مکالمه گوش کنید و عبارت‌های کلیدی را تکرار کنید.',
        en: 'Listen to the dialogue and repeat the key phrases.',
      },
    ],
    [
      'course-en-lesson-4',
      demoChapters[1]!.id,
      'قرار گذاشتن',
      'Making plans',
      'TEXT',
      2,
      600,
      { fa: 'برای زمان و مکان قرار توافق کنید.', en: 'Agree on a time and place to meet.' },
    ],
    [
      'course-en-lesson-5',
      demoChapters[2]!.id,
      'عبارت‌های پیونددهنده',
      'Linking phrases',
      'VIDEO',
      1,
      780,
      { fa: 'با عبارت‌های پیونددهنده مکث‌های طولانی را کمتر کنید.', en: 'Use linking phrases to reduce long pauses.' },
    ],
    [
      'course-en-lesson-6',
      demoChapters[2]!.id,
      'تمرین پایانی',
      'Final practice',
      'QUIZ',
      2,
      480,
      {
        question: 'بهترین پاسخ برای ادامه یک گفت‌وگوی دوستانه کدام است؟',
        options: ['That sounds interesting. Tell me more.', 'No speaking.', 'Yesterday blue.'],
      },
    ],
  ] as const;
  for (const [id, chapterId, titleFa, titleEn, type, order, durationSeconds, content] of demoLessons)
    await db.courseLesson.upsert({
      where: { id },
      create: {
        id,
        chapterId,
        titleFa,
        titleEn,
        type,
        order,
        durationSeconds,
        content,
        preview: id === 'course-en-lesson-1',
      },
      update: { titleFa, titleEn, type, order, durationSeconds, content, published: true },
    });
  await db.courseEnrollment.upsert({
    where: { userId_courseId: { userId: users.demoStudent.id, courseId: rows[0]!.id } },
    create: { userId: users.demoStudent.id, courseId: rows[0]!.id },
    update: {},
  });
}

async function main() {
  await seedUsersAndPermissions();
  await seedLanguages();
  await seedCountries(db);
  await seedTeachers();
  await seedPackages();
  await seedTests();
  await seedBookingsFinanceAndReviews();
  await seedDemoExperience();
  await seedTicketsCmsAndSettings();
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
