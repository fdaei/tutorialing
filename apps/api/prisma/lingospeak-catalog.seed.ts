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
  /** Cover under apps/web/public/images/courses. */
  image: string;
  durationFa: string;
  durationEn: string;
  descriptionFa: string;
  descriptionEn: string;
  outcomesFa: string[];
  outcomesEn: string[];
  audienceFa: string[];
  audienceEn: string[];
};

const toman = (value: number) => value.toLocaleString('fa-IR');
const tomanEn = (value: number) => value.toLocaleString('en-US');
const cover = (name: string) => `/images/courses/${name}.svg`;

/** What a program teaches, independent of how (online/in person) or how long it is sold for. */
type Program = {
  image: string;
  aboutFa: string;
  aboutEn: string;
  outcomesFa: string[];
  outcomesEn: string[];
  audienceFa: string[];
  audienceEn: string[];
};

const PROGRAMS = {
  'general-english': {
    image: cover('general-english'),
    aboutFa:
      'دوره زبان جنرال برای ساختن پایه‌ای محکم و کاربردی در انگلیسی طراحی شده است. ابتدا سطح فعلی شما تعیین می‌شود و کلاس از همان نقطه، بر اساس چارچوب CEFR (از A1 تا C1) پیش می‌رود. هر جلسه ترکیبی از مکالمه، گرامر در بافت، واژگان پرکاربرد و تمرین شنیداری است و تکالیف کوتاه بین جلسات، آموخته‌ها را تثبیت می‌کند. چون کلاس خصوصی است، سرعت و محتوا کاملاً با نیاز و هدف شما تنظیم می‌شود؛ چه برای سفر و کار باشد، چه به‌عنوان مقدمه‌ای برای آزمون‌های بین‌المللی.',
    aboutEn:
      'General English builds a solid, practical foundation. Your current level is assessed first and the class moves forward from there along the CEFR scale (A1 to C1). Each session blends speaking, grammar in context, high-frequency vocabulary and listening practice, with short assignments between sessions to lock in what you learned. Because the class is private, pace and content are shaped entirely around your goal, whether that is travel, work, or a first step towards an international exam.',
    outcomesFa: [
      'مکالمه روان و بااعتمادبه‌نفس در موقعیت‌های روزمره',
      'تسلط بر ساختارهای گرامری پرکاربرد در بافت واقعی',
      'گسترش واژگان کاربردی متناسب با سطح',
      'تقویت مهارت شنیداری و تلفظ',
      'پیشرفت قابل اندازه‌گیری بر اساس سطوح CEFR',
      'تکلیف و بازخورد منظم پس از هر جلسه',
    ],
    outcomesEn: [
      'Fluent, confident speaking in everyday situations',
      'Command of high-frequency grammar in real contexts',
      'A wider practical vocabulary for your level',
      'Stronger listening and pronunciation',
      'Measurable progress along the CEFR levels',
      'Regular homework and feedback after every session',
    ],
    audienceFa: [
      'زبان‌آموزان مبتدی که می‌خواهند از صفر شروع کنند',
      'کسانی که زبان را نیمه‌کاره رها کرده‌اند و می‌خواهند دوباره شروع کنند',
      'افرادی که برای کار، سفر یا مهاجرت به مکالمه نیاز دارند',
    ],
    audienceEn: [
      'Beginners starting from scratch',
      'Learners returning to English after a break',
      'Anyone who needs spoken English for work, travel or relocation',
    ],
  },
  'pre-ielts': {
    image: cover('pre-ielts'),
    aboutFa:
      'پری آیلتس پلی میان زبان عمومی و آمادگی آیلتس است. اگر سطح شما حدود B1 است و هنوز برای کلاس آیلتس آماده نیستید، این دوره پایه‌های لازم را می‌سازد: واژگان آکادمیک، گرامر مورد نیاز رایتینگ و اسپیکینگ، و آشنایی با ساختار چهار مهارت آزمون. در طول ترم با انواع سؤال‌ها آشنا می‌شوید و استراتژی‌های اولیه پاسخ‌گویی را تمرین می‌کنید تا با آمادگی کامل وارد دوره اصلی آیلتس شوید.',
    aboutEn:
      'Pre-IELTS bridges general English and IELTS preparation. If you are around B1 and not yet ready for an IELTS class, this course builds what you need: academic vocabulary, the grammar that writing and speaking demand, and familiarity with the structure of all four test skills. Over the term you meet every question type and practise core strategies so you start the main IELTS course fully prepared.',
    outcomesFa: [
      'آشنایی کامل با ساختار آزمون آیلتس و انواع سؤال‌ها',
      'تقویت واژگان آکادمیک و ساختارهای گرامری آزمون',
      'آموزش استراتژی‌های پایه در چهار مهارت',
      'نوشتن پاراگراف‌های منسجم و آماده‌شدن برای رایتینگ',
      'تمرین اسپیکینگ با موضوعات رایج آزمون',
      'رسیدن به سطح لازم برای شروع دوره آیلتس',
    ],
    outcomesEn: [
      'A clear picture of the IELTS format and question types',
      'Academic vocabulary and test-relevant grammar',
      'Core strategies across all four skills',
      'Coherent paragraph writing as a base for Writing',
      'Speaking practice on common test topics',
      'The level needed to start an IELTS course',
    ],
    audienceFa: [
      'زبان‌آموزان سطح B1 که قصد شرکت در آیلتس دارند',
      'کسانی که نمره آزمایشی آن‌ها زیر ۵ است',
      'افرادی که قبل از دوره آیلتس می‌خواهند پایه آکادمیک خود را تقویت کنند',
    ],
    audienceEn: [
      'B1 learners planning to take IELTS',
      'Anyone whose mock score is below band 5',
      'Learners who want an academic foundation before an IELTS course',
    ],
  },
  'ielts-toefl': {
    image: cover('ielts-toefl'),
    aboutFa:
      'دوره تخصصی آیلتس و تافل برای رسیدن به نمره هدف در کوتاه‌ترین زمان ممکن طراحی شده است. هر چهار مهارت Listening، Reading، Writing و Speaking با تکنیک‌های اختصاصی آزمون، تمرین با نمونه سؤال‌های واقعی و ارزیابی بر اساس معیارهای رسمی نمره‌دهی پوشش داده می‌شود. نقاط ضعف شما در ابتدای دوره مشخص می‌شود و برنامه جلسات روی همان‌ها متمرکز است. مدرسان دوره دارای نمره ۸٫۵ آیلتس و مدرک TESOL هستند.',
    aboutEn:
      'This IELTS & TOEFL course is built to reach your target score as quickly as possible. All four skills — Listening, Reading, Writing and Speaking — are covered with test-specific techniques, practice on authentic questions and assessment against the official band descriptors. Your weak points are identified at the start and the sessions focus on them. The teachers hold IELTS band 8.5 and a TESOL qualification.',
    outcomesFa: [
      'تکنیک‌های تخصصی هر چهار مهارت آزمون',
      'تمرین با نمونه سؤال‌های واقعی و شبیه‌سازی آزمون',
      'ارزیابی رایتینگ و اسپیکینگ بر اساس Band Descriptors',
      'مدیریت زمان در سکشن‌های Listening و Reading',
      'برنامه مطالعاتی شخصی تا روز آزمون',
      'افزایش نمره در مهارت‌های ضعیف‌تر',
    ],
    outcomesEn: [
      'Test-specific techniques for all four skills',
      'Practice on authentic questions and full mock tests',
      'Writing and speaking assessed against the band descriptors',
      'Time management for Listening and Reading',
      'A personal study plan up to test day',
      'A higher score in your weakest skills',
    ],
    audienceFa: [
      'متقاضیان مهاجرت تحصیلی، کاری یا اقامت',
      'زبان‌آموزان سطح B1 به بالا با تاریخ آزمون مشخص',
      'کسانی که یک‌بار آزمون داده‌اند و به نمره هدف نرسیده‌اند',
    ],
    audienceEn: [
      'Applicants for study, work or residence abroad',
      'B1+ learners with a test date booked',
      'Candidates who took the test and missed their target band',
    ],
  },
  listening: {
    image: cover('listening'),
    aboutFa:
      'کلاس تک‌مهارتی Listening روی رایج‌ترین دلایل از دست دادن نمره در این بخش تمرکز دارد: از دست دادن کلمات کلیدی، تله‌های سؤال و خطاهای املایی. در این دوره کوتاه، انواع سؤال‌های چهار پارت آزمون، تکنیک پیش‌بینی پاسخ و خواندن سریع سؤال پیش از پخش فایل تمرین می‌شود.',
    aboutEn:
      'The Listening single-skill class targets the most common reasons candidates lose marks: missed keywords, distractors and spelling errors. In this short course you practise every question type across the four parts, answer prediction, and reading the questions quickly before the recording starts.',
    outcomesFa: [
      'شناخت انواع سؤال در چهار پارت Listening',
      'تکنیک پیش‌بینی پاسخ و شناسایی کلمات کلیدی',
      'پرهیز از تله‌ها و Distractorها',
      'رفع خطاهای املایی و انتقال پاسخ',
    ],
    outcomesEn: [
      'Every question type across the four Listening parts',
      'Answer prediction and keyword spotting',
      'Avoiding distractors',
      'Fixing spelling and answer-transfer errors',
    ],
    audienceFa: ['داوطلبانی که نمره Listening آن‌ها از بقیه مهارت‌ها پایین‌تر است', 'کسانی که فرصت کمی تا آزمون دارند'],
    audienceEn: [
      'Candidates whose Listening lags behind their other skills',
      'Anyone with little time left before the test',
    ],
  },
  reading: {
    image: cover('reading'),
    aboutFa:
      'کلاس تک‌مهارتی Reading برای کسانی است که در زمان محدود آزمون به همه سؤال‌ها نمی‌رسند یا در سؤال‌هایی مثل True/False/Not Given و Matching Headings اشتباه می‌کنند. در طول دوره، روش اسکن و اسکیم متن، مدیریت زمان و استراتژی اختصاصی هر نوع سؤال گام‌به‌گام آموزش داده و با متون آکادمیک واقعی تمرین می‌شود.',
    aboutEn:
      'The Reading single-skill class is for candidates who run out of time or struggle with question types such as True/False/Not Given and Matching Headings. Step by step, the course teaches skimming and scanning, time management and a specific strategy for each question type, all practised on authentic academic texts.',
    outcomesFa: [
      'استراتژی اختصاصی برای هر نوع سؤال Reading',
      'تسلط بر True/False/Not Given و Matching Headings',
      'تکنیک‌های اسکیم و اسکن سریع متن',
      'مدیریت زمان برای پاسخ به هر سه پسیج',
      'تقویت واژگان آکادمیک و مترادف‌یابی',
    ],
    outcomesEn: [
      'A specific strategy for every Reading question type',
      'Confidence with True/False/Not Given and Matching Headings',
      'Fast skimming and scanning techniques',
      'Time management across all three passages',
      'Academic vocabulary and paraphrase recognition',
    ],
    audienceFa: [
      'داوطلبانی که در زمان آزمون به همه پسیج‌ها نمی‌رسند',
      'کسانی که نمره Reading آن‌ها مانع رسیدن به نمره کل شده است',
    ],
    audienceEn: [
      'Candidates who cannot finish all passages in time',
      'Anyone whose Reading score holds back their overall band',
    ],
  },
  'writing-task-1': {
    image: cover('writing-task-1'),
    aboutFa:
      'این کلاس به Writing Task 1 آیلتس اختصاص دارد: توصیف نمودار، جدول، نقشه و فرایند. ساختار استاندارد گزارش، نوشتن Overview قوی، انتخاب داده‌های کلیدی برای مقایسه و واژگان توصیف روند و ارقام آموزش داده می‌شود. هر جلسه همراه با نوشتن نمونه و بازخورد مدرس بر اساس معیارهای نمره‌دهی است.',
    aboutEn:
      'This class is dedicated to IELTS Writing Task 1: describing graphs, tables, maps and processes. It covers the standard report structure, writing a strong overview, selecting key data to compare, and the language of trends and figures. Every session includes writing practice and teacher feedback against the band descriptors.',
    outcomesFa: [
      'ساختار استاندارد گزارش برای انواع نمودار، جدول، نقشه و فرایند',
      'نوشتن Overview دقیق و نمره‌آور',
      'واژگان و ساختارهای توصیف روند و مقایسه ارقام',
      'بازخورد مدرس روی هر نوشته بر اساس Band Descriptors',
    ],
    outcomesEn: [
      'A standard report structure for graphs, tables, maps and processes',
      'An accurate, high-scoring overview',
      'Language for trends and comparing figures',
      'Teacher feedback on every piece against the band descriptors',
    ],
    audienceFa: ['داوطلبان آیلتس آکادمیک', 'کسانی که در Task 1 ساختار مشخصی ندارند'],
    audienceEn: ['IELTS Academic candidates', 'Anyone without a reliable structure for Task 1'],
  },
  'writing-task-2': {
    image: cover('writing-task-2'),
    aboutFa:
      'این کلاس روی Writing Task 2 آیلتس، یعنی نوشتن مقاله ۲۵۰ کلمه‌ای، تمرکز دارد که بیشترین وزن را در نمره رایتینگ دارد. انواع سؤال (Opinion، Discussion، Problem/Solution و Two-part)، برنامه‌ریزی قبل از نوشتن، ساختن استدلال و مثال، پاراگراف‌بندی منسجم و استفاده از ساختارهای پیشرفته گرامری آموزش داده می‌شود و هر مقاله با بازخورد دقیق بازبینی می‌شود.',
    aboutEn:
      'This class focuses on IELTS Writing Task 2, the 250-word essay that carries the most weight in your writing score. It covers every question type (Opinion, Discussion, Problem/Solution and Two-part), planning before you write, building arguments and examples, cohesive paragraphing and advanced grammar, with detailed feedback on every essay.',
    outcomesFa: [
      'شناخت انواع سؤال Task 2 و ساختار مناسب هر کدام',
      'برنامه‌ریزی سریع و ساختن استدلال قانع‌کننده',
      'پاراگراف‌بندی منسجم با Coherence & Cohesion بالا',
      'استفاده از ساختارهای گرامری و واژگان پیشرفته',
      'بازخورد دقیق روی هر مقاله',
    ],
    outcomesEn: [
      'Every Task 2 question type and the structure it needs',
      'Fast planning and convincing arguments',
      'Cohesive paragraphs with strong coherence',
      'Advanced grammar and vocabulary',
      'Detailed feedback on every essay',
    ],
    audienceFa: ['داوطلبان آیلتس آکادمیک و جنرال', 'کسانی که نمره رایتینگ آن‌ها زیر ۶٫۵ مانده است'],
    audienceEn: ['IELTS Academic and General candidates', 'Anyone stuck below band 6.5 in Writing'],
  },
} satisfies Record<string, Program>;

const ONLINE_NOTE_FA = 'جلسات به‌صورت آنلاین و زنده برگزار می‌شود و از هر جای دنیا قابل شرکت است.';
const ONLINE_NOTE_EN = 'Sessions run live online, so you can join from anywhere.';
const IN_PERSON_NOTE_FA = 'جلسات به‌صورت حضوری و چهره‌به‌چهره در آموزشگاه برگزار می‌شود.';
const IN_PERSON_NOTE_EN = 'Sessions are held face to face at the institute.';

function privateClass(
  key: string,
  program: keyof typeof PROGRAMS,
  titleFa: string,
  titleEn: string,
  level: string,
  delivery: CourseDelivery,
  sessions: number,
  perSession: number,
): CatalogCourse {
  const online = delivery === CourseDelivery.ONLINE;
  const info = PROGRAMS[program];
  return {
    key,
    titleFa: `${titleFa} ${online ? 'آنلاین' : 'حضوری'}`,
    titleEn: `${titleEn} (${online ? 'online' : 'in person'})`,
    category: 'private-class',
    level,
    delivery,
    lessonsCount: sessions,
    price: sessions * perSession,
    image: info.image,
    durationFa: `ترم ${toman(sessions)} جلسه‌ای`,
    durationEn: `${sessions}-session term`,
    descriptionFa: `${info.aboutFa}\n\nاین کلاس به‌صورت خصوصی و در قالب یک ترم ${toman(sessions)} جلسه‌ای برگزار می‌شود. ${online ? ONLINE_NOTE_FA : IN_PERSON_NOTE_FA} هزینه هر جلسه ${toman(perSession)} تومان است.`,
    descriptionEn: `${info.aboutEn}\n\nThis is a private class run as a ${sessions}-session term. ${online ? ONLINE_NOTE_EN : IN_PERSON_NOTE_EN} Each session costs ${tomanEn(perSession)} Toman.`,
    outcomesFa: info.outcomesFa,
    outcomesEn: info.outcomesEn,
    audienceFa: info.audienceFa,
    audienceEn: info.audienceEn,
  };
}

function singleSkill(
  key: string,
  program: keyof typeof PROGRAMS,
  skill: string,
  sessions: number,
  perSession: number,
): CatalogCourse {
  const info = PROGRAMS[program];
  return {
    key,
    titleFa: `کلاس تک مهارتی ${skill}`,
    titleEn: `${skill} single-skill class`,
    category: 'single-skill',
    level: 'IELTS',
    delivery: CourseDelivery.ONLINE,
    lessonsCount: sessions,
    price: sessions * perSession,
    image: info.image,
    durationFa: `${toman(sessions)} جلسه`,
    durationEn: `${sessions} sessions`,
    descriptionFa: `${info.aboutFa}\n\nدوره در ${toman(sessions)} جلسه خصوصی آنلاین برگزار می‌شود و هزینه هر جلسه ${toman(perSession)} تومان است.`,
    descriptionEn: `${info.aboutEn}\n\nThe course runs as ${sessions} private online sessions at ${tomanEn(perSession)} Toman per session.`,
    outcomesFa: info.outcomesFa,
    outcomesEn: info.outcomesEn,
    audienceFa: info.audienceFa,
    audienceEn: info.audienceEn,
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
  scopeFa: string,
  scopeEn: string,
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
    image: cover('writing-correction'),
    durationFa: `${toman(essays)} رایتینگ`,
    durationEn: `${essays} essays`,
    descriptionFa: `در این پکیج ${toman(essays)} رایتینگ ${scopeFa} شما توسط مدرس دارای نمره ۸٫۵ آیلتس تصحیح می‌شود. هر نوشته بر اساس چهار معیار رسمی نمره‌دهی (Task Response، Coherence & Cohesion، Lexical Resource و Grammatical Range & Accuracy) بررسی می‌شود و علاوه بر نمره تخمینی، اشتباهات به‌صورت خط‌به‌خط مشخص و نسخه اصلاح‌شده جملات ارائه می‌شود.\n\nهدف فقط تصحیح نیست؛ با دیدن الگوی اشتباهات تکراری و آموختن ساختارهای پیشرفته‌تر، رایتینگ بعدی شما قوی‌تر از قبل خواهد بود. پکیج کاملاً آنلاین است و نوشته‌ها را هر زمان آماده بودید ارسال می‌کنید.`,
    descriptionEn: `This package covers correction of ${essays} ${scopeEn} essays by a teacher with IELTS band 8.5. Each piece is assessed against the four official criteria (Task Response, Coherence & Cohesion, Lexical Resource and Grammatical Range & Accuracy); alongside an estimated band you get line-by-line corrections and improved versions of your sentences.\n\nThe goal is more than marking: by seeing your recurring mistakes and learning stronger structures, each essay gets better than the last. The package is fully online and you submit essays whenever you are ready.`,
    outcomesFa: WRITING_CORRECTION_OUTCOMES_FA,
    outcomesEn: WRITING_CORRECTION_OUTCOMES_EN,
    audienceFa: [
      'داوطلبانی که بدون بازخورد تمرین رایتینگ می‌کنند',
      'کسانی که نمره رایتینگ آن‌ها پایین‌تر از سایر مهارت‌هاست',
      'افرادی که نزدیک به تاریخ آزمون هستند',
    ],
    audienceEn: [
      'Candidates practising writing without feedback',
      'Anyone whose Writing score trails their other skills',
      'Candidates close to their test date',
    ],
  };
}

function singleSession(
  key: string,
  program: keyof typeof PROGRAMS,
  titleFa: string,
  titleEn: string,
  level: string,
  delivery: CourseDelivery,
  price: number,
): CatalogCourse {
  const online = delivery === CourseDelivery.ONLINE;
  const info = PROGRAMS[program];
  return {
    key,
    titleFa: `کلاس تک جلسه‌ای ${titleFa} ${online ? 'آنلاین' : 'حضوری'}`,
    titleEn: `Single session: ${titleEn} (${online ? 'online' : 'in person'})`,
    category: 'single-session',
    level,
    delivery,
    lessonsCount: 1,
    price,
    image: info.image,
    durationFa: 'یک جلسه',
    durationEn: 'One session',
    descriptionFa: `یک جلسه خصوصی ${titleFa} برای آشنایی با شیوه تدریس استاد، پیش از ثبت‌نام در ترم کامل. در این جلسه سطح فعلی شما ارزیابی می‌شود، درباره هدفتان صحبت می‌کنید و بخشی از یک کلاس واقعی را تجربه می‌کنید. در پایان، پیشنهادی روشن برای مسیر و تعداد جلسات مورد نیاز دریافت می‌کنید.\n\n${online ? ONLINE_NOTE_FA : IN_PERSON_NOTE_FA}`,
    descriptionEn: `A single private ${titleEn} session to get to know the teacher's approach before committing to a full term. Your current level is assessed, you discuss your goal, and you experience part of a real class. You leave with a clear recommendation for your route and how many sessions you need.\n\n${online ? ONLINE_NOTE_EN : IN_PERSON_NOTE_EN}`,
    outcomesFa: ['ارزیابی سطح فعلی', 'تجربه یک کلاس واقعی با استاد', 'پیشنهاد مسیر و تعداد جلسات مورد نیاز'],
    outcomesEn: [
      'An assessment of your current level',
      'A taste of a real class with the teacher',
      'A recommended route and session count',
    ],
    audienceFa: [
      `کسانی که قبل از ثبت‌نام در ترم ${titleFa} می‌خواهند کلاس را امتحان کنند`,
      ...info.audienceFa.slice(0, 1),
    ],
    audienceEn: [`Anyone who wants to try ${titleEn} before booking a full term`, ...info.audienceEn.slice(0, 1)],
  };
}

const { ONLINE, IN_PERSON } = CourseDelivery;

export const CATALOG_COURSES: CatalogCourse[] = [
  privateClass(
    'general-english-online',
    'general-english',
    'زبان جنرال',
    'General English',
    'A1–C1',
    ONLINE,
    15,
    552_000,
  ),
  privateClass(
    'general-english-in-person',
    'general-english',
    'زبان جنرال',
    'General English',
    'A1–C1',
    IN_PERSON,
    15,
    752_000,
  ),
  privateClass('pre-ielts-online', 'pre-ielts', 'پری آیلتس', 'Pre-IELTS', 'B1', ONLINE, 15, 552_000),
  privateClass('pre-ielts-in-person', 'pre-ielts', 'پری آیلتس', 'Pre-IELTS', 'B1', IN_PERSON, 15, 752_000),
  privateClass('ielts-toefl-online', 'ielts-toefl', 'آیلتس و تافل', 'IELTS & TOEFL', 'IELTS', ONLINE, 10, 780_000),
  privateClass(
    'ielts-toefl-in-person',
    'ielts-toefl',
    'آیلتس و تافل',
    'IELTS & TOEFL',
    'IELTS',
    IN_PERSON,
    10,
    1_480_000,
  ),
  singleSkill('listening', 'listening', 'Listening', 3, 780_000),
  singleSkill('reading', 'reading', 'Reading', 15, 780_000),
  singleSkill('writing-1', 'writing-task-1', 'Writing 1', 15, 780_000),
  singleSkill('writing-2', 'writing-task-2', 'Writing 2', 15, 780_000),
  writingCorrection(
    'writing-correction-task-2',
    'پکیج تصحیح رایتینگ تسک ۲',
    'Writing Task 2 correction package',
    'تسک ۲ (مقاله)',
    'Task 2',
    4,
    1_980_000,
  ),
  writingCorrection(
    'writing-correction-task-1',
    'پکیج تصحیح رایتینگ تسک ۱',
    'Writing Task 1 correction package',
    'تسک ۱ (گزارش نمودار)',
    'Task 1',
    4,
    1_980_000,
  ),
  // The supplied brief gives no essay count for the mix; four of each task is
  // assumed, matching the two single-task packages.
  writingCorrection(
    'writing-correction-mix',
    'پکیج میکس تصحیح رایتینگ تسک ۱ و ۲',
    'Writing Task 1 & 2 mixed correction package',
    'تسک ۱ و تسک ۲ (چهار نوشته از هر کدام)',
    'Task 1 and Task 2 (four of each)',
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
    image: cover('mentoring'),
    durationFa: '۴ جلسه ۴۰ دقیقه‌ای',
    durationEn: '4 sessions of 40 minutes',
    descriptionFa:
      'بسیاری از زبان‌آموزان وقت و انرژی زیادی صرف می‌کنند اما چون مسیر مشخصی ندارند، پیشرفتشان کند است. پکیج منتورینگ شامل چهار جلسه ۴۰ دقیقه‌ای آنلاین است که در آن، بر اساس هدف شما (مهاجرت، آزمون، کار یا مکالمه) و زمانی که در اختیار دارید، یک مسیر یادگیری شخصی ترسیم می‌شود.\n\nدر این جلسات منابع مناسب معرفی می‌شود، روش درست مطالعه و مرور را می‌آموزید، برنامه هفتگی تنظیم می‌شود و در جلسات بعدی پیشرفت شما بررسی، اشکالات رفع و برنامه به‌روز می‌شود. در طول دوره هم برای سؤال‌هایتان پشتیبانی دریافت می‌کنید.',
    descriptionEn:
      'Many learners put in plenty of time and effort but progress slowly because they lack a clear route. The mentoring package is four 40-minute online sessions that map a personal learning route around your goal (relocation, an exam, work or conversation) and the time you have.\n\nYou get the right resources, learn how to study and review effectively, and build a weekly plan; later sessions review your progress, resolve problems and update the plan. You also have support for your questions throughout.',
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
    audienceFa: [
      'زبان‌آموزانی که خودخوان مطالعه می‌کنند و به برنامه نیاز دارند',
      'کسانی که با وجود تلاش، پیشرفت محسوسی نمی‌بینند',
      'افرادی که نمی‌دانند از کجا و با چه منابعی شروع کنند',
    ],
    audienceEn: [
      'Self-study learners who need a plan',
      'Anyone putting in effort without visible progress',
      "Learners who don't know where or with what to start",
    ],
  },
  singleSession(
    'single-general-english-online',
    'general-english',
    'زبان جنرال',
    'General English',
    'A1–C1',
    ONLINE,
    552_000,
  ),
  singleSession(
    'single-general-english-in-person',
    'general-english',
    'زبان جنرال',
    'General English',
    'A1–C1',
    IN_PERSON,
    752_000,
  ),
  singleSession('single-pre-ielts-online', 'pre-ielts', 'پری آیلتس', 'Pre-IELTS', 'B1', ONLINE, 552_000),
  singleSession('single-pre-ielts-in-person', 'pre-ielts', 'پری آیلتس', 'Pre-IELTS', 'B1', IN_PERSON, 752_000),
  singleSession('single-ielts-toefl-online', 'ielts-toefl', 'آیلتس و تافل', 'IELTS & TOEFL', 'IELTS', ONLINE, 780_000),
  singleSession(
    'single-ielts-toefl-in-person',
    'ielts-toefl',
    'آیلتس و تافل',
    'IELTS & TOEFL',
    'IELTS',
    IN_PERSON,
    1_480_000,
  ),
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
    // rather than colliding with it on the unique phone. Also check by the
    // deterministic catalog id: a prior seed run may have created it under a
    // different placeholder phone, which would otherwise collide on the id.
    const deterministicId = catalogUserId(teacher.key);
    const existingUser =
      (await db.user.findUnique({ where: { phone }, select: { id: true } })) ??
      (await db.user.findUnique({ where: { id: deterministicId }, select: { id: true } }));
    const userId = existingUser?.id ?? deterministicId;
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
    else if (existingUser.id === deterministicId)
      await db.user.update({ where: { id: deterministicId }, data: { phone } });
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
          image: course.image,
          category: course.category,
          format: CourseFormat.LIVE_ONLINE,
          delivery: course.delivery,
          durationFa: course.durationFa,
          durationEn: course.durationEn,
          outcomesFa: course.outcomesFa,
          outcomesEn: course.outcomesEn,
          audienceFa: course.audienceFa,
          audienceEn: course.audienceEn,
          sortOrder: CATALOG_TEACHERS.indexOf(teacher) * 100 + index,
          published: true,
        },
        update: {},
      });
    }
  }
  return installed;
}
