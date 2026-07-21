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
} from '@prisma/client';

const db = new PrismaClient();
const DAY = 86_400_000;
const now = new Date();
const at = (days: number, hour: number, minute = 0) => {
  const date = new Date(now.getTime() + days * DAY);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
};

const users = {
  admin: { id: 'user-admin', phone: '09120000000', name: 'مدیر کل', email: 'admin@local.test', role: Role.ADMIN },
  verifier: { id: 'user-verifier', phone: '09120000010', name: 'کارشناس تأیید مدرس', email: 'verifier@local.test', role: Role.STAFF },
  support: { id: 'user-support', phone: '09120000011', name: 'کارشناس پشتیبانی', email: 'support@local.test', role: Role.SUPPORT },
  finance: { id: 'user-finance', phone: '09120000012', name: 'کارشناس مالی', email: 'finance@local.test', role: Role.FINANCE },
  examiner: { id: 'user-examiner', phone: '09120000013', name: 'ارزیاب آزمون', email: 'examiner@local.test', role: Role.EXAMINER },
  approvedTeacher: { id: 'user-teacher-approved', phone: '09120000001', name: 'سارا دادخواه', email: 'sara@local.test', role: Role.TEACHER },
  germanTeacher: { id: 'user-teacher-german', phone: '09120000002', name: 'آرمان نیک‌روش', email: 'arman@local.test', role: Role.TEACHER },
  pendingTeacher: { id: 'user-teacher-pending', phone: '09120000004', name: 'نیلوفر آذری', email: 'niloofar@local.test', role: Role.TEACHER },
  completedStudent: { id: 'user-student-completed', phone: '09121111111', name: 'نازنین کاظمی', email: 'nazanin@local.test', role: Role.STUDENT },
  futureStudent: { id: 'user-student-future', phone: '09121111112', name: 'علی رضایی', email: 'ali@local.test', role: Role.STUDENT },
  ticketStudent: { id: 'user-student-ticket', phone: '09121111113', name: 'مریم احمدی', email: 'maryam@local.test', role: Role.STUDENT },
} as const;

const permissionKeys = [
  'users.read', 'users.manage', 'teachers.read', 'teachers.verify', 'teacher-prices.manage',
  'languages.manage', 'tests.manage', 'tests.review', 'bookings.read', 'bookings.manage',
  'tickets.read', 'tickets.manage', 'payments.read', 'payments.refund', 'payouts.manage',
  'reviews.manage', 'audit.read', 'settings.manage', 'cms.manage', 'notifications.read',
  'roles.manage', 'reports.read', 'availability.manage',
];

async function seedUsersAndPermissions() {
  for (const user of Object.values(users)) {
    await db.user.upsert({
      where: { phone: user.phone },
      create: { id: user.id, phone: user.phone, name: user.name, email: user.email, profileComplete: true, locale: 'fa', timezone: 'Asia/Tehran' },
      update: { name: user.name, email: user.email, profileComplete: true, status: 'ACTIVE' },
    });
    await db.userRole.upsert({
      where: { userId_role: { userId: user.id, role: user.role } },
      create: { userId: user.id, role: user.role },
      update: {},
    });
  }

  for (const key of permissionKeys) {
    const permission = await db.permission.upsert({
      where: { key },
      create: { key, description: key },
      update: { description: key },
    });
    for (const actor of [users.admin, users.verifier, users.support, users.finance, users.examiner]) {
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
      id: 'policy-flexible', titleFa: 'انعطاف‌پذیر ۲۴ ساعته', titleEn: 'Flexible 24-hour', approvedById: users.admin.id,
      rules: { tiers: [{ beforeHours: 24, refundPercent: 100 }, { beforeHours: 6, refundPercent: 50 }, { beforeHours: 0, refundPercent: 0 }] },
    },
    update: { active: true },
  });

  const teacherRows = [
    {
      id: 'teacher-sara', userId: users.approvedTeacher.id, slug: 'sara-dadkhah', nameFa: 'سارا دادخواه', nameEn: 'Sara Dadkhah',
      bioFa: 'مدرس تأییدشده انگلیسی با تمرکز بر رایتینگ و اسپیکینگ.', bioEn: 'Verified English teacher focused on writing and speaking.',
      gender: 'female', specialties: ['writing', 'speaking'], languages: ['English'], levels: ['B1', 'B2', 'C1'],
      languageId: 'lang-en', status: TeacherStatus.APPROVED, priceStatus: PriceStatus.APPROVED,
      proposedTrialPrice: 290_000, proposedRegularPrice: 690_000, approvedTrialPrice: 290_000, approvedRegularPrice: 690_000,
    },
    {
      id: 'teacher-arman', userId: users.germanTeacher.id, slug: 'arman-nikroush', nameFa: 'آرمان نیک‌روش', nameEn: 'Arman Nikroush',
      bioFa: 'مدرس تأییدشده آلمانی برای سطوح A1 تا B2.', bioEn: 'Verified German teacher for levels A1 through B2.',
      gender: 'male', specialties: ['conversation', 'grammar'], languages: ['Deutsch'], levels: ['A1', 'A2', 'B1', 'B2'],
      languageId: 'lang-de', status: TeacherStatus.APPROVED, priceStatus: PriceStatus.APPROVED,
      proposedTrialPrice: 260_000, proposedRegularPrice: 620_000, approvedTrialPrice: 260_000, approvedRegularPrice: 620_000,
    },
    {
      id: 'teacher-niloofar', userId: users.pendingTeacher.id, slug: 'niloofar-azari', nameFa: 'نیلوفر آذری', nameEn: 'Niloofar Azari',
      bioFa: 'متقاضی تدریس زبان ترکی و انگلیسی.', bioEn: 'Teacher applicant for Turkish and English.',
      gender: 'female', specialties: ['conversation'], languages: ['Türkçe'], levels: ['A1', 'A2'],
      languageId: 'lang-tr', status: TeacherStatus.DOCUMENT_REVIEW, priceStatus: PriceStatus.SUBMITTED,
      proposedTrialPrice: 220_000, proposedRegularPrice: 540_000, approvedTrialPrice: null, approvedRegularPrice: null,
    },
  ] as const;

  for (const row of teacherRows) {
    await db.teacher.upsert({
      where: { id: row.id },
      create: {
        id: row.id, userId: row.userId, slug: row.slug, nameFa: row.nameFa, nameEn: row.nameEn, bioFa: row.bioFa, bioEn: row.bioEn,
        status: row.status, gender: row.gender, experienceYears: 7, trialPrice: row.proposedTrialPrice, regularPrice: row.proposedRegularPrice,
        trialDuration: 30, lessonDuration: 60, breakMinutes: 15, proposedTrialPrice: row.proposedTrialPrice,
        proposedRegularPrice: row.proposedRegularPrice, approvedTrialPrice: row.approvedTrialPrice, approvedRegularPrice: row.approvedRegularPrice,
        priceStatus: row.priceStatus, priceReviewedById: row.priceStatus === PriceStatus.APPROVED ? users.admin.id : null,
        priceReviewedAt: row.priceStatus === PriceStatus.APPROVED ? now : null, specialties: [...row.specialties], languages: [...row.languages],
        targetBands: row.languageId === 'lang-en' ? [6.5, 7, 7.5, 8] : [], policyId: policy.id,
        submittedAt: at(-20, 9), approvedAt: row.status === TeacherStatus.APPROVED ? at(-15, 10) : null,
      },
      update: {
        userId: row.userId, nameFa: row.nameFa, nameEn: row.nameEn, bioFa: row.bioFa, bioEn: row.bioEn, status: row.status,
        gender: row.gender, proposedTrialPrice: row.proposedTrialPrice, proposedRegularPrice: row.proposedRegularPrice,
        approvedTrialPrice: row.approvedTrialPrice, approvedRegularPrice: row.approvedRegularPrice, priceStatus: row.priceStatus,
        specialties: [...row.specialties], languages: [...row.languages], policyId: policy.id,
      },
    });
    await db.teacherLanguage.upsert({
      where: { teacherId_languageId: { teacherId: row.id, languageId: row.languageId } },
      create: { teacherId: row.id, languageId: row.languageId, levels: [...row.levels], specialties: [...row.specialties], active: true },
      update: { levels: [...row.levels], specialties: [...row.specialties], active: true },
    });
    await db.teacherPriceHistory.upsert({
      where: { id: `price-history-${row.id}` },
      create: {
        id: `price-history-${row.id}`, teacherId: row.id, actorId: row.priceStatus === PriceStatus.APPROVED ? users.admin.id : row.userId,
        actorRole: row.priceStatus === PriceStatus.APPROVED ? Role.ADMIN : Role.TEACHER, action: row.priceStatus === PriceStatus.APPROVED ? 'FINAL_APPROVED' : 'PROPOSED',
        status: row.priceStatus, proposedTrialPrice: row.proposedTrialPrice, proposedRegularPrice: row.proposedRegularPrice,
        approvedTrialPrice: row.approvedTrialPrice, approvedRegularPrice: row.approvedRegularPrice,
      },
      update: { status: row.priceStatus, proposedTrialPrice: row.proposedTrialPrice, proposedRegularPrice: row.proposedRegularPrice },
    });

    for (const weekday of [0, 1, 2, 3, 4, 5]) {
      await db.availabilityRule.upsert({
        where: { id: `rule-${row.id}-${weekday}` },
        create: { id: `rule-${row.id}-${weekday}`, teacherId: row.id, weekday, startMinute: 540, endMinute: 1260, timezone: 'Asia/Tehran', lessonDuration: 60, breakMinutes: 15, active: true },
        update: { startMinute: 540, endMinute: 1260, timezone: 'Asia/Tehran', lessonDuration: 60, breakMinutes: 15, active: true },
      });
    }
  }

  const files = [
    { id: 'file-teacher-id', ownerId: users.approvedTeacher.id, key: 'seed/teacher-id.pdf', originalName: 'identity.pdf', mimeType: 'application/pdf', size: 120_000, checksum: 'seed-teacher-id', purpose: 'teacher_document' },
    { id: 'file-teacher-video', ownerId: users.approvedTeacher.id, key: 'seed/intro.mp4', originalName: 'intro.mp4', mimeType: 'video/mp4', size: 1_200_000, checksum: 'seed-teacher-video', purpose: 'teacher_intro' },
    { id: 'file-pending-certificate', ownerId: users.pendingTeacher.id, key: 'seed/certificate.pdf', originalName: 'certificate.pdf', mimeType: 'application/pdf', size: 210_000, checksum: 'seed-pending-certificate', purpose: 'teacher_document' },
  ];
  for (const file of files) await db.storedFile.upsert({ where: { id: file.id }, create: { ...file, status: 'SAFE' }, update: { status: 'SAFE' } });

  await db.verificationItem.upsert({
    where: { id: 'verification-approved-id' },
    create: { id: 'verification-approved-id', teacherId: 'teacher-sara', kind: 'IDENTITY', fileId: 'file-teacher-id', status: DocumentStatus.APPROVED, reviewedById: users.verifier.id, reviewedAt: at(-15, 10), submittedAt: at(-20, 9) },
    update: { status: DocumentStatus.APPROVED, fileId: 'file-teacher-id', reviewedById: users.verifier.id },
  });
  await db.verificationItem.upsert({
    where: { id: 'verification-pending-certificate' },
    create: { id: 'verification-pending-certificate', teacherId: 'teacher-niloofar', kind: 'CERTIFICATE', fileId: 'file-pending-certificate', status: DocumentStatus.NEEDS_REVISION, reviewedById: users.verifier.id, reviewedAt: at(-1, 10), rejectionReason: 'تصویر مهر مؤسسه خوانا نیست؛ نسخه واضح‌تر بارگذاری کنید.', submittedAt: at(-3, 9) },
    update: { status: DocumentStatus.NEEDS_REVISION, rejectionReason: 'تصویر مهر مؤسسه خوانا نیست؛ نسخه واضح‌تر بارگذاری کنید.' },
  });

  await db.blockedPeriod.upsert({
    where: { id: 'block-teacher-sara' },
    create: { id: 'block-teacher-sara', teacherId: 'teacher-sara', startsAt: at(3, 8), endsAt: at(3, 10), reason: 'جلسه شخصی' },
    update: { startsAt: at(3, 8), endsAt: at(3, 10), reason: 'جلسه شخصی' },
  });
}

async function seedTests() {
  const listeningAudio = await db.storedFile.upsert({
    where: { id: 'file-listening-audio' },
    create: { id: 'file-listening-audio', ownerId: users.admin.id, key: 'seed/listening.webm', originalName: 'listening.webm', mimeType: 'audio/webm', size: 90_000, checksum: 'seed-listening', status: 'SAFE', purpose: 'test_audio' },
    update: { status: 'SAFE' },
  });
  const speakingAudio = await db.storedFile.upsert({
    where: { id: 'file-speaking-answer' },
    create: { id: 'file-speaking-answer', ownerId: users.completedStudent.id, key: 'seed/speaking-answer.webm', originalName: 'speaking-answer.webm', mimeType: 'audio/webm', size: 140_000, checksum: 'seed-speaking-answer', status: 'SAFE', purpose: 'test_answer' },
    update: { status: 'SAFE' },
  });

  const test = await db.testDefinition.upsert({
    where: { slug: 'english-placement-b1' },
    create: { id: 'test-english-b1', slug: 'english-placement-b1', languageId: 'lang-en', level: 'B1', titleFa: 'تعیین سطح انگلیسی B1', titleEn: 'English B1 Placement', descriptionFa: 'آزمون مستقل انگلیسی با بخش‌های بسته و تشریحی', descriptionEn: 'English-specific assessment with objective and descriptive sections', durationMinutes: 75, published: true },
    update: { languageId: 'lang-en', level: 'B1', published: true },
  });
  const germanTest = await db.testDefinition.upsert({
    where: { slug: 'german-placement-a2' },
    create: { id: 'test-german-a2', slug: 'german-placement-a2', languageId: 'lang-de', level: 'A2', titleFa: 'تعیین سطح آلمانی A2', titleEn: 'German A2 Placement', descriptionFa: 'آزمون مستقل زبان آلمانی', descriptionEn: 'German-specific placement assessment', durationMinutes: 30, published: true },
    update: { languageId: 'lang-de', level: 'A2', published: true },
  });

  const sections = [
    { id: 'section-en-listening', testId: test.id, skill: 'listening', title: 'Listening', instructions: { fa: 'فایل را گوش کنید.', en: 'Listen to the audio.' }, durationMinutes: 15, order: 1 },
    { id: 'section-en-writing', testId: test.id, skill: 'writing', title: 'Writing', instructions: { fa: 'پاسخ را بنویسید.', en: 'Write your response.' }, durationMinutes: 40, order: 2 },
    { id: 'section-en-speaking', testId: test.id, skill: 'speaking', title: 'Speaking', instructions: { fa: 'پاسخ را ضبط کنید.', en: 'Record your response.' }, durationMinutes: 20, order: 3 },
    { id: 'section-de-reading', testId: germanTest.id, skill: 'reading', title: 'Lesen', instructions: { fa: 'متن آلمانی را بخوانید.', en: 'Read the German text.' }, durationMinutes: 30, order: 1 },
  ];
  for (const section of sections) await db.testSection.upsert({
    where: { id: section.id }, create: section, update: { title: section.title, instructions: section.instructions, durationMinutes: section.durationMinutes, order: section.order },
  });

  const questions = [
    { id: 'q-en-listening', sectionId: 'section-en-listening', prompt: { fa: 'گوینده کجا زندگی می‌کند؟', en: 'Where does the speaker live?' }, type: 'single_choice', choices: { fa: ['لندن', 'لیدز'], en: ['London', 'Leeds'] }, answerKey: 0, audioFileId: listeningAudio.id, points: 1, order: 1 },
    { id: 'q-en-writing', sectionId: 'section-en-writing', prompt: { fa: 'درباره هدف یادگیری خود بنویسید.', en: 'Write about your learning goal.' }, type: 'essay', scoringRule: { minWords: 120 }, points: 9, order: 1 },
    { id: 'q-en-speaking', sectionId: 'section-en-speaking', prompt: { fa: 'درباره شهر خود صحبت کنید.', en: 'Talk about your city.' }, type: 'recording', scoringRule: { minSeconds: 30 }, points: 9, order: 1 },
    { id: 'q-de-reading', sectionId: 'section-de-reading', prompt: { fa: 'گزینه درست آلمانی را انتخاب کنید.', en: 'Choose the correct German option.' }, type: 'single_choice', choices: { fa: ['Guten Morgen', 'Good morning'], en: ['Guten Morgen', 'Good morning'] }, answerKey: 0, points: 1, order: 1 },
  ];
  for (const question of questions) await db.question.upsert({
    where: { id: question.id }, create: question, update: { prompt: question.prompt, type: question.type, choices: question.choices, answerKey: question.answerKey, scoringRule: question.scoringRule, audioFileId: question.audioFileId, points: question.points },
  });

  const completedAttempt = await db.testAttempt.upsert({
    where: { id: 'attempt-completed' },
    create: { id: 'attempt-completed', userId: users.completedStudent.id, testId: test.id, status: TestStatus.APPROVED, currentSectionId: null, startedAt: at(-12, 8), expiresAt: at(-12, 10), submittedAt: at(-12, 9, 30), overallBand: 7 },
    update: { status: TestStatus.APPROVED, overallBand: 7, submittedAt: at(-12, 9, 30) },
  });
  const pendingAttempt = await db.testAttempt.upsert({
    where: { id: 'attempt-pending-review' },
    create: { id: 'attempt-pending-review', userId: users.ticketStudent.id, testId: test.id, status: TestStatus.UNDER_REVIEW, currentSectionId: null, startedAt: at(-1, 8), expiresAt: at(-1, 10), submittedAt: at(-1, 9, 30) },
    update: { status: TestStatus.UNDER_REVIEW, submittedAt: at(-1, 9, 30) },
  });

  const completedAnswers = [
    { id: 'answer-complete-objective', attemptId: completedAttempt.id, questionId: 'q-en-listening', value: 0, autoScore: 1, finalScore: 1, reviewStatus: null },
    { id: 'answer-complete-writing', attemptId: completedAttempt.id, questionId: 'q-en-writing', textValue: 'A complete seed writing response used for the approved review workflow.', finalScore: 7, reviewStatus: AnswerReviewStatus.APPROVED, reviewCriteria: { coherence: 7, grammar: 7 }, feedbackFa: 'ساختار پاسخ منسجم است.', feedbackEn: 'The response is coherent.', reviewerId: users.examiner.id, reviewedAt: at(-11, 10) },
    { id: 'answer-complete-speaking', attemptId: completedAttempt.id, questionId: 'q-en-speaking', fileId: speakingAudio.id, finalScore: 7, reviewStatus: AnswerReviewStatus.APPROVED, reviewCriteria: { fluency: 7, pronunciation: 7 }, feedbackFa: 'روانی و تلفظ مناسب است.', feedbackEn: 'Fluency and pronunciation are appropriate.', reviewerId: users.examiner.id, reviewedAt: at(-11, 10) },
    { id: 'answer-pending-writing', attemptId: pendingAttempt.id, questionId: 'q-en-writing', textValue: 'This answer is waiting for a human reviewer.', reviewStatus: AnswerReviewStatus.PENDING },
    { id: 'answer-pending-speaking', attemptId: pendingAttempt.id, questionId: 'q-en-speaking', fileId: speakingAudio.id, reviewStatus: AnswerReviewStatus.PENDING },
  ] as const;
  for (const answer of completedAnswers) await db.testAnswer.upsert({
    where: { id: answer.id }, create: answer, update: { ...answer },
  });

  for (const row of [
    { id: 'score-completed-listening', attemptId: completedAttempt.id, skill: 'listening', autoBand: 7, finalBand: 7 },
    { id: 'score-completed-writing', attemptId: completedAttempt.id, skill: 'writing', finalBand: 7, criteria: { coherence: 7, grammar: 7 }, feedback: 'Approved examiner feedback', approvedById: users.examiner.id, approvedAt: at(-11, 10) },
    { id: 'score-completed-speaking', attemptId: completedAttempt.id, skill: 'speaking', finalBand: 7, criteria: { fluency: 7 }, feedback: 'Approved examiner feedback', approvedById: users.examiner.id, approvedAt: at(-11, 10) },
  ]) await db.testScore.upsert({ where: { id: row.id }, create: row, update: row });
}

async function seedBookingsFinanceAndReviews() {
  const completed = await db.booking.upsert({
    where: { id: 'booking-completed-eligible' },
    create: { id: 'booking-completed-eligible', studentId: users.completedStudent.id, teacherId: 'teacher-sara', startsAt: at(-10, 9), endsAt: at(-10, 10), timezone: 'Asia/Tehran', type: 'regular', status: BookingStatus.COMPLETED, price: 690_000, policySnapshot: {}, attendanceStudent: true, attendanceTeacher: true, meetingUrl: 'https://meet.local/completed' },
    update: { status: BookingStatus.COMPLETED, attendanceStudent: true, attendanceTeacher: true },
  });
  const paid = await db.booking.upsert({
    where: { id: 'booking-completed-paid' },
    create: { id: 'booking-completed-paid', studentId: users.completedStudent.id, teacherId: 'teacher-sara', startsAt: at(-24, 9), endsAt: at(-24, 10), timezone: 'Asia/Tehran', type: 'regular', status: BookingStatus.COMPLETED, price: 690_000, policySnapshot: {}, attendanceStudent: true, attendanceTeacher: true },
    update: { status: BookingStatus.COMPLETED, attendanceStudent: true, attendanceTeacher: true },
  });
  const future = await db.booking.upsert({
    where: { id: 'booking-future-confirmed' },
    create: { id: 'booking-future-confirmed', studentId: users.futureStudent.id, teacherId: 'teacher-arman', startsAt: at(5, 12), endsAt: at(5, 13), timezone: 'Asia/Tehran', type: 'trial', status: BookingStatus.CONFIRMED, price: 260_000, policySnapshot: {}, meetingUrl: 'https://meet.local/future' },
    update: { startsAt: at(5, 12), endsAt: at(5, 13), status: BookingStatus.CONFIRMED },
  });
  await db.booking.upsert({
    where: { id: 'booking-cancelled' },
    create: { id: 'booking-cancelled', studentId: users.ticketStudent.id, teacherId: 'teacher-sara', startsAt: at(-4, 12), endsAt: at(-4, 13), timezone: 'Asia/Tehran', type: 'trial', status: BookingStatus.CANCELLED, price: 290_000, policySnapshot: {}, cancelledAt: at(-5, 10), cancellationReason: 'لغو توسط زبان‌آموز' },
    update: { status: BookingStatus.CANCELLED, cancellationReason: 'لغو توسط زبان‌آموز' },
  });

  for (const booking of [completed, paid, future]) await db.payment.upsert({
    where: { id: `payment-${booking.id}` },
    create: { id: `payment-${booking.id}`, bookingId: booking.id, userId: booking.studentId, purpose: 'BOOKING', referenceId: booking.id, subtotal: booking.price, gatewayAmount: booking.price, amount: booking.price, status: PaymentStatus.PAID, idempotencyKey: `seed-payment-${booking.id}`, gatewayReference: `seed-${booking.id}`, verifiedAt: now },
    update: { status: PaymentStatus.PAID, amount: booking.price, verifiedAt: now },
  });

  const eligible = await db.earning.upsert({
    where: { bookingId: completed.id },
    create: { id: 'earning-eligible', teacherId: completed.teacherId, bookingId: completed.id, grossAmount: completed.price, commissionAmount: 103_500, netAmount: 586_500, status: EarningStatus.ELIGIBLE, eligibleAt: at(-9, 0) },
    update: { status: EarningStatus.ELIGIBLE, grossAmount: completed.price, commissionAmount: 103_500, netAmount: 586_500 },
  });
  const paidEarning = await db.earning.upsert({
    where: { bookingId: paid.id },
    create: { id: 'earning-paid', teacherId: paid.teacherId, bookingId: paid.id, grossAmount: paid.price, commissionAmount: 103_500, netAmount: 586_500, status: EarningStatus.PAID, eligibleAt: at(-23, 0) },
    update: { status: EarningStatus.PAID },
  });
  const payout = await db.payoutBatch.upsert({
    where: { id: 'payout-previous' },
    create: { id: 'payout-previous', weekStart: at(-28, 0), weekEnd: at(-21, 23), status: PayoutStatus.TRANSFERRED, totalAmount: 586_500, approvedById: users.admin.id, approvedAt: at(-20, 10), transferredAt: at(-19, 10), reference: 'SEED-PAYOUT-001' },
    update: { status: PayoutStatus.TRANSFERRED, totalAmount: 586_500 },
  });
  await db.payoutItem.upsert({
    where: { earningId: paidEarning.id },
    create: { id: 'payout-item-paid', batchId: payout.id, earningId: paidEarning.id, teacherId: paidEarning.teacherId, amount: paidEarning.netAmount },
    update: { batchId: payout.id, amount: paidEarning.netAmount },
  });

  await db.review.upsert({
    where: { bookingId: completed.id },
    create: { id: 'review-approved', teacherId: completed.teacherId, studentId: completed.studentId, bookingId: completed.id, rating: 5, comment: 'کلاس منظم و بازخوردها بسیار کاربردی بود.', moderationStatus: ReviewStatus.APPROVED, published: true, moderatedById: users.admin.id, moderatedAt: at(-8, 9), teacherResponse: 'از اعتماد شما ممنونم.', respondedAt: at(-7, 9) },
    update: { rating: 5, moderationStatus: ReviewStatus.APPROVED, published: true, moderatedById: users.admin.id },
  });
  const rating = await db.review.aggregate({ where: { teacherId: completed.teacherId, published: true, moderationStatus: ReviewStatus.APPROVED }, _avg: { rating: true }, _count: { _all: true } });
  await db.teacher.update({ where: { id: completed.teacherId }, data: { rating: rating._avg.rating ?? 0, reviewsCount: rating._count._all } });

  void eligible;
}

async function seedTicketsCmsAndSettings() {
  const ticket = await db.ticket.upsert({
    where: { id: 'ticket-assigned-open' },
    create: { id: 'ticket-assigned-open', userId: users.ticketStudent.id, subject: 'مشکل در مشاهده نوبت رزروشده', category: 'booking', priority: 'HIGH', status: TicketStatus.IN_PROGRESS, assignedToId: users.support.id, slaDueAt: at(1, 12), lastReplyAt: at(0, 8) },
    update: { status: TicketStatus.IN_PROGRESS, assignedToId: users.support.id, slaDueAt: at(1, 12) },
  });
  const replies = [
    { id: 'ticket-reply-user', authorId: users.ticketStudent.id, authorRole: Role.STUDENT, direction: TicketDirection.INBOUND, messageType: TicketMessageType.USER_MESSAGE, body: 'نوبت آینده در داشبورد من نمایش داده نمی‌شود.', internal: false, createdAt: at(-1, 8) },
    { id: 'ticket-reply-support', authorId: users.support.id, authorRole: Role.SUPPORT, direction: TicketDirection.OUTBOUND, messageType: TicketMessageType.STAFF_REPLY, body: 'موضوع را بررسی می‌کنیم و نتیجه را اطلاع می‌دهیم.', internal: false, createdAt: at(-1, 9) },
    { id: 'ticket-reply-note', authorId: users.support.id, authorRole: Role.SUPPORT, direction: TicketDirection.INTERNAL, messageType: TicketMessageType.INTERNAL_NOTE, body: 'کش رزروها پس از اصلاح باید invalidate شود.', internal: true, createdAt: at(-1, 9, 10) },
  ];
  for (const reply of replies) await db.ticketReply.upsert({ where: { id: reply.id }, create: { ...reply, ticketId: ticket.id }, update: { body: reply.body } });
  await db.ticketStatusHistory.upsert({
    where: { id: 'ticket-status-history-open' },
    create: { id: 'ticket-status-history-open', ticketId: ticket.id, fromStatus: TicketStatus.OPEN, toStatus: TicketStatus.IN_PROGRESS, actorId: users.support.id, note: 'بررسی آغاز شد.' },
    update: { toStatus: TicketStatus.IN_PROGRESS, note: 'بررسی آغاز شد.' },
  });
  await db.ticketAssignmentHistory.upsert({
    where: { id: 'ticket-assignment-history' },
    create: { id: 'ticket-assignment-history', ticketId: ticket.id, toAssigneeId: users.support.id, actorId: users.admin.id, note: 'ارجاع به پشتیبانی رزروها' },
    update: { toAssigneeId: users.support.id },
  });
  await db.notification.upsert({
    where: { id: 'notification-ticket-assigned' },
    create: { id: 'notification-ticket-assigned', userId: users.support.id, type: 'TICKET_ASSIGNED', titleFa: 'تیکت جدید به شما ارجاع شد', titleEn: 'A ticket was assigned to you', bodyFa: ticket.subject, bodyEn: ticket.subject, data: { ticketId: ticket.id, href: `/admin/tickets/${ticket.id}` } },
    update: { data: { ticketId: ticket.id, href: `/admin/tickets/${ticket.id}` } },
  });

  await db.setting.upsert({
    where: { key: 'support.phone' },
    create: { key: 'support.phone', value: { number: '02191094200', hoursFa: 'شنبه تا پنج‌شنبه، ۹ تا ۲۰', hoursEn: 'Saturday–Thursday, 9–20' }, public: true },
    update: { public: true },
  });
  await db.setting.upsert({
    where: { key: 'sms.enabled' }, create: { key: 'sms.enabled', value: { enabled: false }, public: false }, update: { value: { enabled: false } },
  });

  const pages = [
    {
      slug: 'about', titleFa: 'درباره ما', titleEn: 'About us',
      contentFa: { paragraphs: ['لینگواسپیک برای ساده‌کردن مسیر پیدا کردن مدرس زبان ساخته شده است. ما مدرس‌ها را بررسی می‌کنیم، امکان تعیین سطح و مقایسه شفاف را فراهم می‌کنیم و به زبان‌آموز کمک می‌کنیم کلاس مناسب هدف، بودجه و زمان خود را پیدا کند.'] },
      contentEn: { paragraphs: ['LingoSpeak makes finding the right language teacher simpler. We verify teachers, provide language-specific assessments and transparent comparisons, and help learners book classes that fit their goals, budget and schedule.'] },
    },
    { slug: 'how-it-works', titleFa: 'نحوه کار', titleEn: 'How it works', contentFa: { paragraphs: ['زبان را انتخاب کنید، سطح خود را بسنجید و مدرس مناسب را رزرو کنید.'] }, contentEn: { paragraphs: ['Choose a language, assess your level, and book the right teacher.'] } },
    { slug: 'faq', titleFa: 'سؤالات متداول', titleEn: 'FAQ', contentFa: { paragraphs: ['پاسخ سؤالات متداول از پنل مدیریت قابل ویرایش است.'] }, contentEn: { paragraphs: ['Frequently asked questions are editable from the admin panel.'] } },
  ];
  for (const page of pages) await db.cmsPage.upsert({
    where: { slug: page.slug },
    create: { ...page, seo: { description: page.titleFa }, published: true },
    update: { titleFa: page.titleFa, titleEn: page.titleEn, contentFa: page.contentFa, contentEn: page.contentEn, published: true },
  });
}

async function seedAudit() {
  const rows: Array<{ actorId: string; action: string; entity: string; entityId: string; after: Prisma.InputJsonValue }> = [
    { actorId: users.admin.id, action: 'teacher.price.final_approved', entity: 'Teacher', entityId: 'teacher-sara', after: { approvedTrialPrice: 290_000, approvedRegularPrice: 690_000 } },
    { actorId: users.verifier.id, action: 'teacher.document.needs_revision', entity: 'VerificationItem', entityId: 'verification-pending-certificate', after: { reason: 'Unreadable stamp' } },
    { actorId: users.support.id, action: 'ticket.assigned', entity: 'Ticket', entityId: 'ticket-assigned-open', after: { assignedToId: users.support.id } },
  ];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    await db.auditLog.upsert({ where: { id: `seed-audit-${index + 1}` }, create: { id: `seed-audit-${index + 1}`, ...row }, update: { after: row.after } });
  }
}

async function main() {
  await seedUsersAndPermissions();
  await seedLanguages();
  await seedTeachers();
  await seedTests();
  await seedBookingsFinanceAndReviews();
  await seedTicketsCmsAndSettings();
  await seedAudit();
  console.log('Seed completed successfully with multilingual workflow data.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
