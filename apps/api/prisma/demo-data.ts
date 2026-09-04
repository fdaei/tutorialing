import '../src/env';
import { Prisma, PrismaClient, Role } from '@prisma/client';
import { randomBytes, randomInt, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { closeSync, constants, openSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { promisify } from 'node:util';

const db = new PrismaClient();
const scrypt = promisify(nodeScrypt);
const PREFIX = 'client-demo-2026-';
const ADMIN_ID = `${PREFIX}admin`;
const DAY = 86_400_000;
const now = new Date();
const at = (days: number, hour = 10) => new Date(now.getTime() + days * DAY + (hour - now.getUTCHours()) * 3_600_000);

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
] as const;

function requireFlag(command: string) {
  if (process.env.DEMO_DATA_IMPORT !== 'true') {
    throw new Error(`${command} refused: set DEMO_DATA_IMPORT=true explicitly`);
  }
}

function requireBackup() {
  if (process.env.DEMO_DATA_BACKUP_CONFIRMED !== 'true' || !process.env.DEMO_DATA_BACKUP_REFERENCE?.trim()) {
    throw new Error(
      'Import refused: take a database backup, then set DEMO_DATA_BACKUP_CONFIRMED=true and DEMO_DATA_BACKUP_REFERENCE',
    );
  }
}

function credentialPath() {
  const raw = process.env.DEMO_ADMIN_CREDENTIALS_FILE;
  if (!raw || !isAbsolute(raw)) throw new Error('DEMO_ADMIN_CREDENTIALS_FILE must be an absolute server-side path');
  const path = resolve(raw);
  const repo = resolve(process.cwd().endsWith('/apps/api') ? process.cwd() + '/../..' : process.cwd());
  const rel = relative(repo, path);
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) {
    throw new Error('Credential note must be outside the source repository');
  }
  return path;
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('base64url');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString('base64url')}`;
}

async function passwordMatches(password: string, stored: string | null) {
  if (!stored) return false;
  const [algorithm, salt, encoded] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !encoded) return false;
  const expected = Buffer.from(encoded, 'base64url');
  const candidate = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

const students = [
  ['ava', 'آوا محمدی', 'Ava Mohammadi'],
  ['amir', 'امیر حسینی', 'Amir Hosseini'],
  ['sara', 'سارا کریمی', 'Sara Karimi'],
  ['navid', 'نوید رضایی', 'Navid Rezaei'],
  ['leila', 'لیلا احمدی', 'Leila Ahmadi'],
  ['armin', 'آرمین جعفری', 'Armin Jafari'],
  ['neda', 'ندا موسوی', 'Neda Mousavi'],
  ['pouya', 'پویا رحیمی', 'Pouya Rahimi'],
  ['yasmin', 'یاسمین شریفی', 'Yasmin Sharifi'],
  ['sam', 'سام نادری', 'Sam Naderi'],
  ['mina', 'مینا اکبری', 'Mina Akbari'],
  ['reza', 'رضا یوسفی', 'Reza Yousefi'],
] as const;

const teachers = [
  {
    key: 'emma',
    fa: 'اما ویلسون',
    en: 'Emma Wilson',
    lang: 'en',
    language: 'English',
    rating: 4.9,
    reviews: 47,
    years: 9,
    price: 920000,
    specialties: ['Conversation', 'IELTS'],
  },
  {
    key: 'daniel',
    fa: 'دنیل کوپر',
    en: 'Daniel Cooper',
    lang: 'en',
    language: 'English',
    rating: 4.7,
    reviews: 31,
    years: 7,
    price: 780000,
    specialties: ['Business English', 'Pronunciation'],
  },
  {
    key: 'anna',
    fa: 'آنا مولر',
    en: 'Anna Müller',
    lang: 'de',
    language: 'German',
    rating: 4.8,
    reviews: 38,
    years: 8,
    price: 850000,
    specialties: ['Goethe', 'Migration German'],
  },
  {
    key: 'lukas',
    fa: 'لوکاس وبر',
    en: 'Lukas Weber',
    lang: 'de',
    language: 'German',
    rating: 4.6,
    reviews: 22,
    years: 6,
    price: 740000,
    specialties: ['Conversation', 'Grammar'],
  },
  {
    key: 'sofia',
    fa: 'سوفیا گارسیا',
    en: 'Sofía García',
    lang: 'es',
    language: 'Spanish',
    rating: 4.9,
    reviews: 42,
    years: 10,
    price: 820000,
    specialties: ['DELE', 'Travel Spanish'],
  },
  {
    key: 'claire',
    fa: 'کلر مارتن',
    en: 'Claire Martin',
    lang: 'fr',
    language: 'French',
    rating: 4.8,
    reviews: 35,
    years: 8,
    price: 880000,
    specialties: ['DELF', 'Academic French'],
  },
] as const;

const languages = [
  ['en', 'انگلیسی', 'English', 'English', '🇬🇧'],
  ['de', 'آلمانی', 'German', 'Deutsch', '🇩🇪'],
  ['es', 'اسپانیایی', 'Spanish', 'Español', '🇪🇸'],
  ['fr', 'فرانسوی', 'French', 'Français', '🇫🇷'],
] as const;

const courses = [
  {
    key: 'english-a1',
    teacher: 'emma',
    lang: 'English',
    level: 'Beginner',
    fa: 'انگلیسی کاربردی از صفر',
    en: 'Practical English from Zero',
    price: 1490000,
    lessons: 18,
    rating: 4.8,
  },
  {
    key: 'english-b2',
    teacher: 'daniel',
    lang: 'English',
    level: 'Intermediate',
    fa: 'مکالمه انگلیسی برای کار',
    en: 'English for the Workplace',
    price: 2390000,
    lessons: 24,
    rating: 4.7,
  },
  {
    key: 'english-c1',
    teacher: 'emma',
    lang: 'English',
    level: 'Advanced',
    fa: 'آمادگی پیشرفته آیلتس',
    en: 'Advanced IELTS Preparation',
    price: 3290000,
    lessons: 30,
    rating: 4.9,
  },
  {
    key: 'german-a1',
    teacher: 'anna',
    lang: 'German',
    level: 'Beginner',
    fa: 'آلمانی A1 برای شروع مهاجرت',
    en: 'German A1 for Newcomers',
    price: 1890000,
    lessons: 20,
    rating: 4.8,
  },
  {
    key: 'german-b2',
    teacher: 'lukas',
    lang: 'German',
    level: 'Intermediate',
    fa: 'آلمانی روزمره B2',
    en: 'Everyday German B2',
    price: 2590000,
    lessons: 26,
    rating: 4.6,
  },
  {
    key: 'spanish-a1',
    teacher: 'sofia',
    lang: 'Spanish',
    level: 'Beginner',
    fa: 'اسپانیایی برای سفر',
    en: 'Spanish for Travel',
    price: 1690000,
    lessons: 16,
    rating: 4.9,
  },
  {
    key: 'french-b1',
    teacher: 'claire',
    lang: 'French',
    level: 'Intermediate',
    fa: 'فرانسوی B1 با اعتمادبه‌نفس',
    en: 'Confident French B1',
    price: 2190000,
    lessons: 22,
    rating: 4.8,
  },
] as const;

type Tx = Prisma.TransactionClient;

async function createDemo(tx: Tx, adminHash: string, adminIdentity: string, adminPhone: string) {
  const languageIds = new Map<string, string>();
  for (const [index, lang] of languages.entries()) {
    const language = await tx.language.upsert({
      where: { code: lang[0] },
      create: {
        id: `${PREFIX}language-${lang[0]}`,
        code: lang[0],
        nameFa: lang[1],
        nameEn: lang[2],
        nativeName: lang[3],
        flag: lang[4],
        order: index + 1,
      },
      update: {},
    });
    languageIds.set(lang[0], language.id);
  }

  await tx.user.create({
    data: {
      id: ADMIN_ID,
      phone: adminPhone,
      email: adminIdentity,
      name: 'Lingoespeak Client Demo Admin',
      passwordHash: adminHash,
      profileComplete: true,
      roles: { create: { role: Role.ADMIN } },
    },
  });
  for (const key of permissionKeys) {
    const permission = await tx.permission.upsert({ where: { key }, create: { key, description: key }, update: {} });
    await tx.rolePermission.create({ data: { userId: ADMIN_ID, role: Role.ADMIN, permissionId: permission.id } });
  }

  for (const [index, student] of students.entries()) {
    await tx.user.create({
      data: {
        id: `${PREFIX}student-${student[0]}`,
        phone: `+120255501${String(index).padStart(2, '0')}`,
        email: `${student[0]}.demo@lingospeak.invalid`,
        name: student[1],
        birthDate: new Date(Date.UTC(1988 + (index % 10), index % 12, 5 + index)),
        avatarKey: `demo/avatars/${student[0]}.svg`,
        profileComplete: index !== 11,
        locale: index % 4 === 0 ? 'en' : 'fa',
        roles: { create: { role: Role.STUDENT } },
      },
    });
  }

  const policy = await tx.cancellationPolicy.create({
    data: {
      id: `${PREFIX}policy`,
      titleFa: 'سیاست استاندارد کلاس آزمایشی',
      titleEn: 'Standard demo lesson policy',
      rules: { fullRefundHours: 24, partialRefundHours: 8 },
      active: true,
    },
  });
  for (const [index, item] of teachers.entries()) {
    const userId = `${PREFIX}teacher-user-${item.key}`;
    const teacherId = `${PREFIX}teacher-${item.key}`;
    await tx.user.create({
      data: {
        id: userId,
        phone: `+120255501${20 + index}`,
        email: `${item.key}.teacher@lingospeak.invalid`,
        name: item.fa,
        avatarKey: `demo/teachers/${item.key}.svg`,
        profileComplete: true,
        roles: { create: { role: Role.INSTRUCTOR } },
      },
    });
    await tx.teacher.create({
      data: {
        id: teacherId,
        userId,
        slug: `demo-${item.key}`,
        nameFa: item.fa,
        nameEn: item.en,
        bioFa: `مدرس باتجربه ${item.language} با رویکرد عملی و برنامه شخصی‌سازی‌شده.`,
        bioEn: `Experienced ${item.language} teacher focused on practical communication and personalized learning plans.`,
        status: 'APPROVED',
        rating: item.rating,
        reviewsCount: item.reviews,
        experienceYears: item.years,
        gender: index % 2 ? 'male' : 'female',
        trialPrice: Math.round(item.price * 0.55),
        regularPrice: item.price,
        approvedTrialPrice: Math.round(item.price * 0.55),
        approvedRegularPrice: item.price,
        priceStatus: 'APPROVED',
        specialties: [...item.specialties],
        languages: [item.language],
        targetBands: [5.5, 6.5, 7.5],
        introVideoKey: `demo/teachers/${item.key}-intro.mp4`,
        policyId: policy.id,
        submittedAt: at(-180 + index),
        approvedAt: at(-170 + index),
      },
    });
    await tx.teacherLanguage.create({
      data: {
        teacherId,
        languageId: languageIds.get(item.lang)!,
        levels: ['A1', 'A2', 'B1', 'B2', 'C1'],
        specialties: [...item.specialties],
      },
    });
    for (const weekday of [1, 2, 3, 4, 5])
      await tx.availabilityRule.create({
        data: { teacherId, weekday, startMinute: 540, endMinute: 1080, timezone: 'Asia/Tehran', lessonDuration: 60 },
      });
  }

  await tx.user.create({
    data: {
      id: `${PREFIX}teacher-user-pending`,
      phone: '+12025550126',
      email: 'julien.teacher@lingospeak.invalid',
      name: 'Julien Bernard',
      profileComplete: true,
      roles: { create: { role: Role.INSTRUCTOR } },
    },
  });
  await tx.teacher.create({
    data: {
      id: `${PREFIX}teacher-pending`,
      userId: `${PREFIX}teacher-user-pending`,
      slug: 'demo-julien-pending',
      nameFa: 'ژولین برنار',
      nameEn: 'Julien Bernard',
      bioFa: 'مدرس فرانسوی در مرحله بررسی مدارک و سوابق آموزشی.',
      bioEn: 'French instructor currently completing document and experience review.',
      status: 'DOCUMENT_REVIEW',
      experienceYears: 5,
      proposedTrialPrice: 430000,
      proposedRegularPrice: 790000,
      priceStatus: 'UNDER_REVIEW',
      specialties: ['Conversation', 'TEF'],
      languages: ['French'],
      submittedAt: at(-4),
    },
  });
  await tx.teacherLanguage.create({
    data: {
      teacherId: `${PREFIX}teacher-pending`,
      languageId: languageIds.get('fr')!,
      levels: ['A1', 'A2', 'B1', 'B2'],
      specialties: ['Conversation', 'TEF'],
    },
  });

  for (const [courseIndex, course] of courses.entries()) {
    const courseId = `${PREFIX}course-${course.key}`;
    const teacher = teachers.find((t) => t.key === course.teacher)!;
    await tx.course.create({
      data: {
        id: courseId,
        slug: `demo-${course.key}`,
        titleFa: course.fa,
        titleEn: course.en,
        descriptionFa: `دوره‌ای ساختاریافته و پروژه‌محور برای سطح ${course.level} همراه تمرین، بازخورد و مسیر پیشرفت روشن.`,
        descriptionEn: `A structured, project-based ${course.level.toLowerCase()} course with practice, feedback, and a clear progress path.`,
        language: course.lang,
        level: course.level,
        teacherName: teacher.en,
        teacherId: `${PREFIX}teacher-${course.teacher}`,
        lessonsCount: course.lessons,
        price: course.price,
        image: `/demo/courses/${course.key}.svg`,
        published: true,
        rating: course.rating,
        reviewsCount: 6 + courseIndex,
      },
    });
    for (let chapterNo = 1; chapterNo <= 3; chapterNo++) {
      const chapter = await tx.courseChapter.create({
        data: {
          id: `${courseId}-chapter-${chapterNo}`,
          courseId,
          titleFa: `بخش ${chapterNo}: مهارت‌های کلیدی`,
          titleEn: `Part ${chapterNo}: Core Skills`,
          order: chapterNo,
        },
      });
      for (let lessonNo = 1; lessonNo <= 3; lessonNo++)
        await tx.courseLesson.create({
          data: {
            id: `${courseId}-lesson-${chapterNo}-${lessonNo}`,
            chapterId: chapter.id,
            titleFa: `درس ${lessonNo}: تمرین کاربردی`,
            titleEn: `Lesson ${lessonNo}: Practical Workshop`,
            descriptionEn: 'Guided practice with examples and a short exercise.',
            type: lessonNo === 3 ? 'QUIZ' : lessonNo === 2 ? 'VIDEO' : 'TEXT',
            content: { demo: true, summary: 'Client presentation content' },
            durationSeconds: 900 + lessonNo * 300,
            order: lessonNo,
            preview: chapterNo === 1 && lessonNo === 1,
          },
        });
    }
  }

  for (let i = 0; i < students.length; i++) {
    const student = students[i]!;
    const course = courses[i % courses.length]!;
    const enrollmentId = `${PREFIX}course-enrollment-${i}`;
    const completed = i % 4 === 0;
    await tx.courseEnrollment.create({
      data: {
        id: enrollmentId,
        userId: `${PREFIX}student-${student[0]}`,
        courseId: `${PREFIX}course-${course.key}`,
        completedAt: completed ? at(-5 - i) : null,
        lastLessonId: `${PREFIX}course-${course.key}-lesson-${completed ? 3 : 1}-${(i % 3) + 1}`,
      },
    });
    const progressCount = completed ? 9 : (i % 7) + 1;
    for (let p = 0; p < progressCount; p++) {
      const chapter = Math.floor(p / 3) + 1;
      const lesson = (p % 3) + 1;
      await tx.courseLessonProgress.create({
        data: {
          enrollmentId,
          lessonId: `${PREFIX}course-${course.key}-lesson-${chapter}-${lesson}`,
          positionSeconds: p === progressCount - 1 && !completed ? 420 : 0,
          completedAt: completed || p < progressCount - 1 ? at(-20 + p) : null,
          lastViewedAt: at(-Math.max(0, progressCount - p)),
        },
      });
    }
    await tx.courseReview.create({
      data: {
        id: `${PREFIX}course-review-${i}`,
        userId: `${PREFIX}student-${student[0]}`,
        courseId: `${PREFIX}course-${course.key}`,
        rating: 4 + (i % 2),
        comment:
          i % 2
            ? 'The lessons are clear and the exercises feel practical.'
            : 'مسیر دوره منظم است و تمرین‌ها برای پیشرفت واقعی کاربردی هستند.',
        isVerified: true,
      },
    });
  }

  for (let i = 0; i < 16; i++) {
    const student = students[i % students.length]!;
    const teacher = teachers[i % teachers.length]!;
    const completed = i < 10;
    const bookingId = `${PREFIX}booking-${i}`;
    await tx.booking.create({
      data: {
        id: bookingId,
        studentId: `${PREFIX}student-${student[0]}`,
        teacherId: `${PREFIX}teacher-${teacher.key}`,
        startsAt: at(completed ? -30 + i * 2 : 2 + i, 14 + (i % 4)),
        endsAt: at(completed ? -30 + i * 2 : 2 + i, 15 + (i % 4)),
        timezone: 'Asia/Tehran',
        type: i % 5 === 0 ? 'TRIAL' : 'REGULAR',
        status: completed ? 'COMPLETED' : 'CONFIRMED',
        price: teacher.price,
        policySnapshot: { demo: true, fullRefundHours: 24 },
        meetingUrl: `https://meet.example.invalid/demo-${i}`,
        attendanceStudent: completed ? true : null,
        attendanceTeacher: completed ? true : null,
      },
    });
    await tx.payment.create({
      data: {
        id: `${PREFIX}payment-${i}`,
        bookingId,
        userId: `${PREFIX}student-${student[0]}`,
        purpose: 'BOOKING',
        referenceId: bookingId,
        subtotal: teacher.price,
        gatewayAmount: teacher.price,
        amount: teacher.price,
        status: 'PAID',
        authority: `${PREFIX}authority-${i}`,
        gatewayReference: `${PREFIX}gateway-${i}`,
        idempotencyKey: `${PREFIX}payment-${i}`,
        verifiedAt: at(completed ? -30 + i * 2 : -2),
      },
    });
    if (completed)
      await tx.review.create({
        data: {
          id: `${PREFIX}teacher-review-${i}`,
          teacherId: `${PREFIX}teacher-${teacher.key}`,
          studentId: `${PREFIX}student-${student[0]}`,
          bookingId,
          rating: 4 + (i % 2),
          comment:
            i % 2
              ? 'Patient, prepared, and very encouraging throughout the lesson.'
              : 'مدرس بسیار صبور بود و بازخوردهای دقیق و قابل اجرا ارائه کرد.',
          moderationStatus: i >= 8 ? 'PENDING' : 'APPROVED',
          published: i < 8,
          moderatedById: i >= 8 ? null : ADMIN_ID,
          moderatedAt: i >= 8 ? null : at(-2),
        },
      });
  }

  const category = await tx.blogCategory.create({
    data: {
      id: `${PREFIX}blog-category`,
      slug: 'demo-learning-guides',
      nameFa: 'راهنمای یادگیری و مهاجرت',
      nameEn: 'Learning & Migration Guides',
    },
  });
  const posts = [
    ['language-before-migration', 'چطور پیش از مهاجرت زبان بخوانیم؟', 'How to Learn a Language Before Moving Abroad'],
    ['german-job-interview', 'واژگان ضروری مصاحبه کاری آلمانی', 'Essential German for Job Interviews'],
    ['daily-language-habit', 'ساخت عادت روزانه یادگیری زبان', 'Building a Daily Language Habit'],
    ['ielts-study-plan', 'برنامه واقع‌بینانه آمادگی آیلتس', 'A Realistic IELTS Study Plan'],
    ['french-study-options', 'راهنمای زبان برای تحصیل در فرانسه', 'Language Guide for Studying in France'],
  ] as const;
  for (const [i, post] of posts.entries()) {
    const postId = `${PREFIX}blog-${post[0]}`;
    await tx.blogPost.create({
      data: {
        id: postId,
        slug: `demo-${post[0]}`,
        titleFa: post[1],
        titleEn: post[2],
        excerptFa: 'راهنمایی عملی، مرحله‌به‌مرحله و مبتنی بر تجربه برای زبان‌آموزان.',
        excerptEn: 'A practical, step-by-step guide grounded in real learner experience.',
        contentFa:
          '<h2>یک مسیر روشن</h2><p>هدف خود را مشخص کنید، برنامه هفتگی بسازید و پیشرفت را با تمرین واقعی بسنجید.</p>',
        contentEn:
          '<h2>A clear path</h2><p>Define your goal, build a weekly plan, and measure progress through real practice.</p>',
        coverImage: `/demo/blog/${post[0]}.svg`,
        status: 'PUBLISHED',
        authorId: ADMIN_ID,
        categoryId: category.id,
        publishedAt: at(-35 + i * 6),
        submittedAt: at(-37 + i * 6),
        reviewedAt: at(-36 + i * 6),
        reviewedById: ADMIN_ID,
      },
    });
    for (let c = 0; c < 2; c++)
      await tx.blogComment.create({
        data: {
          id: `${postId}-comment-${c}`,
          postId,
          userId: `${PREFIX}student-${students[(i + c) % students.length]![0]}`,
          body: c
            ? 'I used this checklist and it made my weekly study much easier.'
            : 'این مقاله دقیقاً به سؤال‌هایی که برای شروع داشتم پاسخ داد.',
          status: 'APPROVED',
          createdAt: at(-10 + i + c),
        },
      });
    for (let v = 0; v < 8 + i * 3; v++)
      await tx.blogView.create({
        data: { postId, visitorKey: `${PREFIX}visitor-${i}-${v}`, createdAt: at(-i - (v % 5)) },
      });
  }

  for (let i = 0; i < 12; i++)
    await tx.auditLog.create({
      data: {
        id: `${PREFIX}audit-${i}`,
        actorId: ADMIN_ID,
        action: ['demo.user.created', 'demo.booking.completed', 'demo.course.published'][i % 3]!,
        entity: ['User', 'Booking', 'Course'][i % 3]!,
        entityId: `${PREFIX}activity-${i}`,
        after: { demo: true },
        createdAt: at(-i, 9 + (i % 8)),
      },
    });
}

async function importDemo() {
  requireFlag('Import');
  requireBackup();
  const existing = await db.user.findUnique({ where: { id: ADMIN_ID }, select: { id: true } });
  if (existing) throw new Error('Demo dataset already exists; verify it or remove it before importing again');
  const notePath = credentialPath();
  const password = randomBytes(24).toString('base64url');
  const identity = `client.demo.admin+${randomBytes(8).toString('hex')}@lingospeak.invalid`;
  // NANP 555-0100–0199 is reserved for fictional use. 90–99 does not overlap the other fixtures.
  const phone = `+120255501${randomInt(90, 100)}`;
  const passwordHash = await hashPassword(password);
  if (!(await passwordMatches(password, passwordHash)))
    throw new Error('Generated admin credential failed verification');
  let fd: number | undefined;
  let noteCreated = false;
  try {
    fd = openSync(notePath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
    noteCreated = true;
    writeFileSync(
      fd,
      `Lingoespeak client demo administrator\nIdentity: ${identity}\nPassword: ${password}\nCreated: ${new Date().toISOString()}\n`,
      { encoding: 'utf8' },
    );
    closeSync(fd);
    fd = undefined;
    await db.$transaction((tx) => createDemo(tx, passwordHash, identity, phone), {
      maxWait: 10_000,
      timeout: 120_000,
    });
    console.log(
      'Demo import complete: 20 users, 7 teachers, 7 courses, 16 bookings, 22 reviews, 5 posts, 10 comments.',
    );
    console.log('Admin credential note was written with mode 0600; its contents were not logged.');
  } catch (error) {
    if (fd !== undefined) closeSync(fd);
    if (noteCreated)
      try {
        unlinkSync(notePath);
      } catch {
        /* the new note may already have been removed by the operator */
      }
    throw error;
  }
}

async function verifyDemo() {
  requireFlag('Verification');
  const notePath = credentialPath();
  const noteStat = statSync(notePath);
  if (!noteStat.isFile() || (noteStat.mode & 0o077) !== 0)
    throw new Error('Protected credential note must be a regular file with no group/other permissions');
  const note = readFileSync(notePath, 'utf8');
  const identity = note.match(/^Identity: (.+)$/m)?.[1];
  const password = note.match(/^Password: (.+)$/m)?.[1];
  if (!identity || !password) throw new Error('Protected credential note is malformed');
  const admin = await db.user.findUnique({
    where: { id: ADMIN_ID },
    include: { roles: { include: { permissions: { include: { permission: true } } } } },
  });
  if (!admin || admin.email !== identity || !(await passwordMatches(password, admin.passwordHash)))
    throw new Error('Normal password credential verification failed');
  const adminRole = admin.roles[0];
  if (admin.roles.length !== 1 || !adminRole || adminRole.role !== Role.ADMIN)
    throw new Error('Demo admin must have exactly the ADMIN role');
  const granted = new Set(adminRole.permissions.map((p) => p.permission.key));
  if (permissionKeys.some((key) => !granted.has(key))) throw new Error('Demo admin is missing dashboard permissions');
  const stats = await db.dashboardStat.findUnique({ where: { id: 'platform' } });
  if (
    !stats ||
    stats.activeUsers < 20n ||
    stats.activeTeachers < 6n ||
    stats.pendingTeachers < 1n ||
    stats.bookings < 16n
  )
    throw new Error('Dashboard projection does not include the demo dataset');
  console.log(
    'Demo verification passed: password authentication, ADMIN-only role, permissions, and dashboard projection.',
  );
}

async function removeDemo() {
  requireFlag('Removal');
  requireBackup();
  await db.$transaction(
    async (tx) => {
      await tx.auditLog.deleteMany({ where: { id: { startsWith: PREFIX } } });
      await tx.blogPost.deleteMany({ where: { id: { startsWith: PREFIX } } });
      await tx.blogCategory.deleteMany({ where: { id: { startsWith: PREFIX } } });
      await tx.review.deleteMany({ where: { id: { startsWith: PREFIX } } });
      await tx.payment.deleteMany({ where: { id: { startsWith: PREFIX } } });
      await tx.booking.deleteMany({ where: { id: { startsWith: PREFIX } } });
      await tx.course.deleteMany({ where: { id: { startsWith: PREFIX } } });
      await tx.teacher.deleteMany({ where: { id: { startsWith: PREFIX } } });
      await tx.cancellationPolicy.deleteMany({ where: { id: { startsWith: PREFIX } } });
      await tx.user.deleteMany({ where: { id: { startsWith: PREFIX } } });
      await tx.language.deleteMany({
        where: {
          id: { startsWith: PREFIX },
          teachers: { none: {} },
          tests: { none: {} },
          matchingSessions: { none: {} },
        },
      });
      for (const key of permissionKeys) await tx.permission.deleteMany({ where: { key, roles: { none: {} } } });
    },
    { maxWait: 10_000, timeout: 120_000 },
  );
  console.log('Demo rows removed. Delete the protected credential note separately after confirming removal.');
}

const command = process.argv[2];
const operation =
  command === 'import' ? importDemo : command === 'verify' ? verifyDemo : command === 'remove' ? removeDemo : undefined;
if (!operation) {
  console.error('Usage: tsx prisma/demo-data.ts <import|verify|remove>');
  process.exitCode = 2;
} else {
  operation()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : 'Demo operation failed');
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
