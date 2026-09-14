import { CourseDelivery, CourseFormat, PriceStatus, Role, TeacherStatus, type PrismaClient } from '@prisma/client';

// The institute's real teaching staff and course catalog, as supplied by
// LingoSpeak. Like cms-pages.seed.ts this carries no demo users or sample
// transactions, so seed-catalog.ts installs it on production as well.
//
// Every write is create-only: re-running never overwrites a price, bio or
// course an administrator has since edited from the panel. The seed's job is to
// guarantee the baseline exists; the admin panel owns it from then on.

type CatalogTeacher = {
  key: string;
  /** E.164. `null` until the institute supplies the number — see seedLingoSpeakCatalog. */
  phone: string | null;
  email: string | null;
  slug: string;
  nameFa: string;
  nameEn: string;
  bioFa: string;
  bioEn: string;
  gender: 'female' | 'male';
  experienceYears: number;
  image: string;
};

export const CATALOG_TEACHERS: CatalogTeacher[] = [
  {
    key: 'arezoo',
    phone: '+989914673683',
    email: 'arezoo.ahmadi.39@gmail.com',
    slug: 'arezoo-ahmadi',
    nameFa: 'آرزو احمدی',
    nameEn: 'Arezoo Ahmadi',
    bioFa:
      'مدرس آزمون‌های انگلیسی، مدیرعامل و بنیان‌گذار لینگو اسپیک. دارای مدرک TESOL و نمره ۸٫۵ آیلتس با ۱۴ سال سابقه تدریس.',
    bioEn:
      'English exam teacher, CEO and founder of LingoSpeak. TESOL holder, IELTS band 8.5 holder, 14 years of experience.',
    gender: 'female',
    experienceYears: 14,
    image: '/images/teachers/arezoo-ahmadi.jpg',
  },
  {
    key: 'shahriar',
    // TODO(catalog): the institute has not supplied this number yet. Until it is
    // filled in, production skips this teacher and their courses.
    phone: null,
    email: null,
    slug: 'shahriar-shahfar',
    nameFa: 'شهریار شه‌فر',
    nameEn: 'Shahriar Shahfar',
    bioFa: 'مدرس آزمون‌های انگلیسی و زبان عمومی. دارای مدرک TESOL و نمره ۸٫۵ آیلتس با ۱۰ سال سابقه تدریس.',
    bioEn: 'English exam and general English teacher. TESOL holder, IELTS band 8.5 holder, 10 years of experience.',
    gender: 'male',
    experienceYears: 10,
    image: '/images/teachers/shahriar-shahfar.jpg',
  },
];

// The base one-to-one lesson price (general English, online). The trial must be
// exactly half of it — PricingService rejects anything else.
const REGULAR_PRICE = 552_000;
const TRIAL_PRICE = Math.floor(REGULAR_PRICE / 2);

type CatalogCourse = {
  key: string;
  titleFa: string;
  titleEn: string;
  category: 'private-class' | 'single-skill' | 'writing-correction' | 'mentoring' | 'single-session';
  level: string;
  delivery: CourseDelivery;
  /** Sessions, or corrected essays for the writing-correction packages. */
  lessonsCount: number;
  /** Total price of the course in Toman. */
  price: number;
  durationFa: string;
  durationEn: string;
  descriptionFa: string;
  descriptionEn: string;
  outcomesFa?: string[];
  outcomesEn?: string[];
};

const toman = (value: number) => value.toLocaleString('fa-IR');
const tomanEn = (value: number) => value.toLocaleString('en-US');

function privateClass(
  key: string,
  titleFa: string,
  titleEn: string,
  level: string,
  delivery: CourseDelivery,
  sessions: number,
  perSession: number,
): CatalogCourse {
  const online = delivery === CourseDelivery.ONLINE;
  return {
    key,
    titleFa: `${titleFa} ${online ? 'آنلاین' : 'حضوری'}`,
    titleEn: `${titleEn} (${online ? 'online' : 'in person'})`,
    category: 'private-class',
    level,
    delivery,
    lessonsCount: sessions,
    price: sessions * perSession,
    durationFa: `ترم ${toman(sessions)} جلسه‌ای`,
    durationEn: `${sessions}-session term`,
    descriptionFa: `کلاس خصوصی ${online ? 'آنلاین' : 'حضوری'}، ترم ${toman(sessions)} جلسه‌ای. هزینه هر جلسه ${toman(perSession)} تومان.`,
    descriptionEn: `Private ${online ? 'online' : 'in-person'} class, ${sessions}-session term. ${tomanEn(perSession)} Toman per session.`,
  };
}

function singleSkill(key: string, skill: string, sessions: number, perSession: number): CatalogCourse {
  return {
    key,
    titleFa: `کلاس تک مهارتی ${skill}`,
    titleEn: `${skill} single-skill class`,
    category: 'single-skill',
    level: 'IELTS',
    delivery: CourseDelivery.ONLINE,
    lessonsCount: sessions,
    price: sessions * perSession,
    durationFa: `${toman(sessions)} جلسه`,
    durationEn: `${sessions} sessions`,
    descriptionFa: `کلاس تک مهارتی ${skill} در ${toman(sessions)} جلسه. هزینه هر جلسه ${toman(perSession)} تومان.`,
    descriptionEn: `A focused ${skill} class over ${sessions} sessions. ${tomanEn(perSession)} Toman per session.`,
  };
}

const WRITING_CORRECTION_OUTCOMES_FA = [
  'آموزش قالب‌های پیچیده',
  'اصلاح Task Response',
  'اصلاح Coherence & Cohesion',
  'اصلاح Grammatical Range',
  'اصلاح Lexical Resources',
  'بالا بردن نمره رایتینگ',
];
const WRITING_CORRECTION_OUTCOMES_EN = [
  'Complex sentence structures',
  'Task Response corrections',
  'Coherence & Cohesion corrections',
  'Grammatical Range corrections',
  'Lexical Resource corrections',
  'A higher writing score',
];

function writingCorrection(
  key: string,
  titleFa: string,
  titleEn: string,
  essays: number,
  price: number,
): CatalogCourse {
  return {
    key,
    titleFa,
    titleEn,
    category: 'writing-correction',
    level: 'IELTS',
    delivery: CourseDelivery.ONLINE,
    lessonsCount: essays,
    price,
    durationFa: `${toman(essays)} رایتینگ`,
    durationEn: `${essays} essays`,
    descriptionFa: `تصحیح ${toman(essays)} رایتینگ آیلتس با بازخورد دقیق روی معیارهای نمره‌دهی.`,
    descriptionEn: `Correction of ${essays} IELTS essays with detailed feedback against the band descriptors.`,
    outcomesFa: WRITING_CORRECTION_OUTCOMES_FA,
    outcomesEn: WRITING_CORRECTION_OUTCOMES_EN,
  };
}

function singleSession(
  key: string,
  titleFa: string,
  titleEn: string,
  level: string,
  delivery: CourseDelivery,
  price: number,
): CatalogCourse {
  const online = delivery === CourseDelivery.ONLINE;
  return {
    key,
    titleFa: `کلاس تک جلسه‌ای ${titleFa} ${online ? 'آنلاین' : 'حضوری'}`,
    titleEn: `Single session: ${titleEn} (${online ? 'online' : 'in person'})`,
    category: 'single-session',
    level,
    delivery,
    lessonsCount: 1,
    price,
    durationFa: 'یک جلسه',
    durationEn: 'One session',
    descriptionFa: 'یک جلسه برای آشنایی با کلاس‌ها و شیوه تدریس استاد.',
    descriptionEn: "A single session to get to know the classes and the teacher's approach.",
  };
}

const { ONLINE, IN_PERSON } = CourseDelivery;

export const CATALOG_COURSES: CatalogCourse[] = [
  privateClass('general-english-online', 'زبان جنرال', 'General English', 'A1–C1', ONLINE, 15, 552_000),
  privateClass('general-english-in-person', 'زبان جنرال', 'General English', 'A1–C1', IN_PERSON, 15, 752_000),
  privateClass('pre-ielts-online', 'پری آیلتس', 'Pre-IELTS', 'B1', ONLINE, 15, 552_000),
  privateClass('pre-ielts-in-person', 'پری آیلتس', 'Pre-IELTS', 'B1', IN_PERSON, 15, 752_000),
  privateClass('ielts-toefl-online', 'آیلتس و تافل', 'IELTS & TOEFL', 'IELTS', ONLINE, 10, 780_000),
  privateClass('ielts-toefl-in-person', 'آیلتس و تافل', 'IELTS & TOEFL', 'IELTS', IN_PERSON, 10, 1_480_000),
  singleSkill('listening', 'Listening', 3, 780_000),
  singleSkill('reading', 'Reading', 15, 780_000),
  singleSkill('writing-1', 'Writing 1', 15, 780_000),
  singleSkill('writing-2', 'Writing 2', 15, 780_000),
  writingCorrection(
    'writing-correction-task-2',
    'پکیج تصحیح رایتینگ تسک ۲',
    'Writing Task 2 correction package',
    4,
    1_980_000,
  ),
  writingCorrection(
    'writing-correction-task-1',
    'پکیج تصحیح رایتینگ تسک ۱',
    'Writing Task 1 correction package',
    4,
    1_980_000,
  ),
  // The supplied brief gives no essay count for the mix; four of each task is
  // assumed, matching the two single-task packages.
  writingCorrection(
    'writing-correction-mix',
    'پکیج میکس تصحیح رایتینگ تسک ۱ و ۲',
    'Writing Task 1 & 2 mixed correction package',
    8,
    3_500_000,
  ),
  {
    key: 'mentoring',
    titleFa: 'پکیج منتورینگ',
    titleEn: 'Mentoring package',
    category: 'mentoring',
    level: 'All levels',
    delivery: ONLINE,
    lessonsCount: 4,
    price: 1_980_000,
    durationFa: '۴ جلسه ۴۰ دقیقه‌ای',
    durationEn: '4 sessions of 40 minutes',
    descriptionFa: 'چهار جلسه ۴۰ دقیقه‌ای برای ترسیم مسیر شخصی یادگیری، برنامه‌ریزی مطالعاتی و پشتیبانی.',
    descriptionEn: 'Four 40-minute sessions to map a personal learning route, plan your study and stay supported.',
    outcomesFa: [
      'ترسیم مسیر شخصی بر اساس هدف',
      'برنامه‌ریزی مطالعاتی',
      'آموزش مطالعه کردن',
      'رفع اشکال',
      'فیدبک',
      'پشتیبانی',
    ],
    outcomesEn: [
      'A personal route built around your goal',
      'A study plan',
      'How to study effectively',
      'Problem solving',
      'Feedback',
      'Ongoing support',
    ],
  },
  singleSession('single-general-english-online', 'زبان جنرال', 'General English', 'A1–C1', ONLINE, 552_000),
  singleSession('single-general-english-in-person', 'زبان جنرال', 'General English', 'A1–C1', IN_PERSON, 752_000),
  singleSession('single-pre-ielts-online', 'پری آیلتس', 'Pre-IELTS', 'B1', ONLINE, 552_000),
  singleSession('single-pre-ielts-in-person', 'پری آیلتس', 'Pre-IELTS', 'B1', IN_PERSON, 752_000),
  singleSession('single-ielts-toefl-online', 'آیلتس و تافل', 'IELTS & TOEFL', 'IELTS', ONLINE, 780_000),
  singleSession('single-ielts-toefl-in-person', 'آیلتس و تافل', 'IELTS & TOEFL', 'IELTS', IN_PERSON, 1_480_000),
];

export const catalogTeacherId = (key: string) => `teacher-${key}`;
export const catalogUserId = (key: string) => `user-teacher-${key}`;

export type CatalogSeedOptions = {
  /**
   * Stand-in phone numbers for teachers whose real number is still missing.
   * Only the dev seed passes these; production never invents an identity.
   */
  placeholderPhones?: Record<string, string>;
  policyId?: string;
};

/** Returns the teacher ids that were installed, keyed by catalog key. */
export async function seedLingoSpeakCatalog(db: PrismaClient, options: CatalogSeedOptions = {}) {
  const english = await db.language.findUnique({ where: { code: 'en' }, select: { id: true } });
  const installed: Record<string, string> = {};

  for (const teacher of CATALOG_TEACHERS) {
    const phone = teacher.phone ?? options.placeholderPhones?.[teacher.key] ?? null;
    if (!phone) {
      console.warn(`[catalog] skipping ${teacher.nameEn}: no phone number configured`);
      continue;
    }

    // Reuse an account the teacher may already have created by signing in,
    // rather than colliding with it on the unique phone.
    const existingUser = await db.user.findUnique({ where: { phone }, select: { id: true } });
    const userId = existingUser?.id ?? catalogUserId(teacher.key);
    if (!existingUser)
      await db.user.create({
        data: {
          id: userId,
          phone,
          name: teacher.nameFa,
          email: teacher.email,
          profileComplete: true,
          locale: 'fa',
          timezone: 'Asia/Tehran',
          status: 'ACTIVE',
        },
      });
    await db.userRole.upsert({
      where: { userId_role: { userId, role: Role.INSTRUCTOR } },
      create: { userId, role: Role.INSTRUCTOR },
      update: {},
    });

    const approvedAt = new Date();
    const row = await db.teacher.upsert({
      where: { userId },
      create: {
        id: catalogTeacherId(teacher.key),
        userId,
        slug: teacher.slug,
        nameFa: teacher.nameFa,
        nameEn: teacher.nameEn,
        bioFa: teacher.bioFa,
        bioEn: teacher.bioEn,
        status: TeacherStatus.APPROVED,
        gender: teacher.gender,
        experienceYears: teacher.experienceYears,
        trialPrice: TRIAL_PRICE,
        regularPrice: REGULAR_PRICE,
        trialDuration: 30,
        lessonDuration: 60,
        proposedTrialPrice: TRIAL_PRICE,
        proposedRegularPrice: REGULAR_PRICE,
        approvedTrialPrice: TRIAL_PRICE,
        approvedRegularPrice: REGULAR_PRICE,
        priceStatus: PriceStatus.APPROVED,
        priceReviewedAt: approvedAt,
        specialties: ['IELTS', 'TOEFL', 'general', 'writing'],
        languages: ['English'],
        targetBands: [6.5, 7, 7.5, 8],
        policyId: options.policyId ?? null,
        submittedAt: approvedAt,
        approvedAt,
      },
      update: {},
    });
    installed[teacher.key] = row.id;

    if (english)
      await db.teacherLanguage.upsert({
        where: { teacherId_languageId: { teacherId: row.id, languageId: english.id } },
        create: {
          teacherId: row.id,
          languageId: english.id,
          levels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
          specialties: ['IELTS', 'TOEFL', 'general', 'writing'],
          active: true,
        },
        update: {},
      });

    for (let index = 0; index < CATALOG_COURSES.length; index += 1) {
      const course = CATALOG_COURSES[index]!;
      const slug = `${teacher.slug}-${course.key}`;
      await db.course.upsert({
        where: { slug },
        create: {
          slug,
          titleFa: course.titleFa,
          titleEn: course.titleEn,
          descriptionFa: course.descriptionFa,
          descriptionEn: course.descriptionEn,
          summaryFa: `${course.durationFa} با ${teacher.nameFa}`,
          summaryEn: `${course.durationEn} with ${teacher.nameEn}`,
          language: 'انگلیسی',
          level: course.level,
          teacherName: teacher.nameFa,
          teacherId: row.id,
          lessonsCount: course.lessonsCount,
          price: course.price,
          image: teacher.image,
          category: course.category,
          format: CourseFormat.LIVE_ONLINE,
          delivery: course.delivery,
          durationFa: course.durationFa,
          durationEn: course.durationEn,
          outcomesFa: course.outcomesFa ?? [],
          outcomesEn: course.outcomesEn ?? [],
          sortOrder: CATALOG_TEACHERS.indexOf(teacher) * 100 + index,
          published: true,
        },
        update: {},
      });
    }
  }
  return installed;
}
