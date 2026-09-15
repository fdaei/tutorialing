export type LocaleText = {
  fa: string;
  en: string;
};

export type LandingSectionId =
  | 'hero'
  | 'languages'
  | 'benefits'
  | 'placement'
  | 'courses'
  | 'blog'
  | 'faq'
  | 'finalCta';

export type SectionStyle = {
  backgroundColor?: string;
  padding?: string;
  margin?: string;
  borderRadius?: string;
  shadow?: string;
  textAlign?: 'start' | 'center' | 'end';
  headingSize?: string;
  desktop?: boolean;
  tablet?: boolean;
  mobile?: boolean;
};

export type LandingConfig = {
  brand: {
    name: string;
    mark: string;
    /** Logo image: a public path, URL, or `media:<fileId>`. Empty uses the shipped artwork. */
    logo: string;
  };
  header: {
    sticky: boolean;
    background: string;
    nav: Array<{ id: string; label: LocaleText; href: string; visible: boolean }>;
    signIn: LocaleText;
    signUp: LocaleText;
  };
  hero: {
    eyebrow: LocaleText;
    title: LocaleText;
    description: LocaleText;
    primaryButton: { label: LocaleText; href: string };
    secondaryButton: { label: LocaleText; href: string };
    image: string;
    imageAlt: LocaleText;
    imageSide: 'left' | 'right';
    overlay: number;
  };
  languages: {
    eyebrow: LocaleText;
    title: LocaleText;
    description: LocaleText;
    cards: Array<{
      code: string;
      image: string;
      accent: string;
      description: LocaleText;
    }>;
  };
  benefits: {
    eyebrow: LocaleText;
    title: LocaleText;
    items: Array<{ icon: string; title: LocaleText; description: LocaleText }>;
  };
  placement: {
    eyebrow: LocaleText;
    title: LocaleText;
    description: LocaleText;
    button: { label: LocaleText; href: string };
    image: string;
    backgroundColor: string;
  };
  courses: {
    eyebrow: LocaleText;
    title: LocaleText;
    description: LocaleText;
  };
  blog: {
    eyebrow: LocaleText;
    title: LocaleText;
    description: LocaleText;
  };
  faq: {
    eyebrow: LocaleText;
    title: LocaleText;
    items: Array<{ question: LocaleText; answer: LocaleText }>;
  };
  finalCta: {
    eyebrow: LocaleText;
    title: LocaleText;
    button: { label: LocaleText; href: string };
    backgroundColor: string;
  };
  footer: {
    description: LocaleText;
    columns: Array<{ title: LocaleText; links: Array<{ label: LocaleText; href: string }> }>;
    phone: string;
    email: string;
    address: LocaleText;
    copyright: LocaleText;
  };
  sections: Array<{
    id: string;
    type: LandingSectionId;
    label: LocaleText;
    visible: boolean;
    style: SectionStyle;
  }>;
  theme: {
    primary: string;
    secondary: string;
    button: string;
    background: string;
    radius: string;
    shadow: string;
    containerWidth: string;
    /** Persian UI font; one of SITE_FONTS. */
    fontFamily: SiteFont;
    /** Root font size in px (14–19). */
    baseFontSize: string;
    headingWeight: string;
  };
};

export const SITE_FONTS = {
  vazirmatn: { label: 'Vazirmatn', stack: "'Vazirmatn Variable', Vazirmatn, Tahoma, sans-serif" },
  estedad: { label: 'Estedad', stack: "'Estedad Variable', 'Vazirmatn Variable', Tahoma, sans-serif" },
  noto: { label: 'Noto Sans Arabic', stack: "'Noto Sans Arabic Variable', 'Vazirmatn Variable', Tahoma, sans-serif" },
} as const;
export type SiteFont = keyof typeof SITE_FONTS;
export const HEADING_WEIGHTS = ['600', '700', '750', '800', '900'] as const;

const text = (fa: string, en: string): LocaleText => ({ fa, en });

export const defaultLandingConfig: LandingConfig = {
  brand: { name: 'LingoSpeak', mark: 'LS', logo: '' },
  header: {
    sticky: true,
    background: '#ffffff',
    nav: [
      { id: 'home', label: text('خانه', 'Home'), href: '/', visible: true },
      { id: 'languages', label: text('زبان‌ها', 'Languages'), href: '/languages', visible: true },
      { id: 'courses', label: text('دوره‌ها', 'Courses'), href: '/courses', visible: true },
      { id: 'teachers', label: text('مدرس‌ها', 'Teachers'), href: '/teachers', visible: true },
      { id: 'blog', label: text('مجله', 'Journal'), href: '/blog', visible: true },
    ],
    signIn: text('ورود', 'Sign in'),
    signUp: text('ثبت‌نام', 'Sign up free'),
  },
  hero: {
    eyebrow: text('کلاس خصوصی آنلاین با مدرس‌های تأییدشده', 'Private online lessons with verified teachers'),
    title: text('زبان را برای حرف‌زدن یاد بگیر، نه فقط برای امتحان.', 'Learn a language to speak it, not just to pass a test.'),
    description: text(
      'سطحت را رایگان بسنج، مدرسی متناسب با هدفت انتخاب کن و با برنامه‌ای که با زمان تو جور است، جلو برو.',
      'Check your level for free, pick a teacher who fits your goal, and follow a plan that works with your schedule.',
    ),
    primaryButton: { label: text('انتخاب زبان', 'Choose a language'), href: '/languages' },
    secondaryButton: { label: text('تعیین سطح رایگان', 'Free placement test'), href: '/placement' },
    image: '/images/lingospeak-student.png',
    imageAlt: text('زبان‌آموز در حال یادگیری با لپ‌تاپ', 'A language learner studying with a laptop'),
    imageSide: 'right',
    overlay: 0,
  },
  languages: {
    eyebrow: text('زبان‌ها', 'Languages'),
    title: text('کدام زبان را می‌خواهی یاد بگیری؟', 'Which language do you want to learn?'),
    description: text(
      'برای هر زبان، از سطح مبتدی تا پیشرفته، مدرس و دوره پیدا می‌کنی.',
      'Every language has teachers and courses from beginner to advanced.',
    ),
    cards: [
      {
        code: 'en',
        image: '/images/lingospeak-student.png',
        accent: '#ede9fe',
        description: text('برای کار، مهاجرت تحصیلی و مکالمه روزمره.', 'For work, study abroad, and everyday conversation.'),
      },
      {
        code: 'de',
        image: '/images/auth/register.png',
        accent: '#dcfce7',
        description: text('برای تحصیل، کار و زندگی در آلمان.', 'For studying, working, and living in Germany.'),
      },
      {
        code: 'fr',
        image: '/images/auth/login.png',
        accent: '#fee2e2',
        description: text('برای سفر، فرهنگ و مهاجرت به کشورهای فرانسوی‌زبان.', 'For travel, culture, and moving to French-speaking countries.'),
      },
    ],
  },
  benefits: {
    eyebrow: text('چرا LingoSpeak', 'Why LingoSpeak'),
    title: text('یادگیری‌ای که ادامه‌اش آسان است.', 'Learning you can actually keep up with.'),
    items: [
      {
        icon: 'sparkles',
        title: text('تمرین موقعیت‌های واقعی', 'Real-life practice'),
        description: text('مصاحبه کاری، سفر، جلسه یا امتحان؛ هر جلسه روی موقعیتی کار می‌کند که برایت مهم است.', 'Job interviews, travel, meetings, or exams: each lesson works on a situation that matters to you.'),
      },
      {
        icon: 'target',
        title: text('برنامه متناسب با تو', 'A plan that fits you'),
        description: text('برنامه‌ات بر اساس سطح، هدف و ساعت‌هایی که وقت داری چیده می‌شود.', 'Your plan is built around your level, your goal, and the hours you have free.'),
      },
      {
        icon: 'headphones',
        title: text('پشتیبان واقعی، نه ربات', 'Real people, not bots'),
        description: text('در انتخاب مدرس یا دوره مردد هستی؟ تیم پشتیبانی راهنمایی‌ات می‌کند.', 'Not sure which teacher or course to pick? Our support team will help you decide.'),
      },
      {
        icon: 'bar-chart',
        title: text('پیشرفت قابل اندازه‌گیری', 'Measurable progress'),
        description: text('در پنل خودت می‌بینی چه چیزی بهتر شده و قدم بعدی چیست.', 'Your dashboard shows what has improved and what to work on next.'),
      },
    ],
  },
  placement: {
    eyebrow: text('آزمون تعیین سطح رایگان', 'Free placement test'),
    title: text('از سطح درست شروع کن.', 'Start at the right level.'),
    description: text(
      'در کمتر از ۲۰ دقیقه سطحت را بر اساس استاندارد CEFR بسنج و پیشنهاد دوره و مدرس متناسب با آن بگیر.',
      'Find your CEFR level in under 20 minutes and get course and teacher suggestions that match it.',
    ),
    button: { label: text('شروع آزمون تعیین سطح', 'Take the placement test'), href: '/placement' },
    image: '/images/lingospeak-student.png',
    backgroundColor: '#241b51',
  },
  courses: {
    eyebrow: text('دوره‌ها', 'Courses'),
    title: text('دوره‌ای برای هدف تو', 'A course for your goal'),
    description: text('مکالمه، آمادگی آیلتس، زبان تجاری و بیشتر؛ دوره‌ها را بر اساس سطح و مدت‌زمان مقایسه کن.', 'Conversation, IELTS prep, business English, and more. Compare courses by level and length.'),
  },
  blog: {
    eyebrow: text('مجله LingoSpeak', 'LingoSpeak Journal'),
    title: text('نکته‌هایی برای یادگیری سریع‌تر', 'Tips for learning faster'),
    description: text('مقاله‌های کوتاه برای اینکه بین جلسه‌ها هم تمرین کنی.', 'Short articles to help you keep practising between lessons.'),
  },
  faq: {
    eyebrow: text('پرسش‌های متداول', 'Frequently asked'),
    title: text('سؤالی داری؟', 'Have a question?'),
    items: [
      {
        question: text('از کجا بدانم از کدام سطح شروع کنم؟', 'How do I know which level to start at?'),
        answer: text('آزمون تعیین سطح رایگان را بده. بعد از آن، بر اساس نتیجه و هدفت دوره و مدرس پیشنهاد می‌گیری.', 'Take the free placement test. Based on your result and goal, you\'ll get course and teacher suggestions.'),
      },
      {
        question: text('مدرس‌ها چطور انتخاب می‌شوند؟', 'How are teachers selected?'),
        answer: text('هویت، مدارک و سابقه تدریس هر مدرس پیش از نمایش پروفایلش بررسی می‌شود.', 'Every teacher\'s identity, documents, and teaching experience are reviewed before their profile goes live.'),
      },
      {
        question: text('کلاس‌ها چطور برگزار می‌شوند؟', 'How do lessons work?'),
        answer: text('همه کلاس‌ها آنلاین‌اند. ساعت‌های خالی مدرس با منطقه زمانی خودت نمایش داده می‌شود.', 'All lessons are online, and teachers\' free times are shown in your own time zone.'),
      },
      {
        question: text('اگر سؤال یا مشکلی داشته باشم؟', 'What if I have a question or a problem?'),
        answer: text('از پنل کاربری تیکت ثبت کن یا با شماره پایین صفحه تماس بگیر.', 'Open a ticket from your dashboard or call the number at the bottom of the page.'),
      },
    ],
  },
  finalCta: {
    eyebrow: text('آماده‌ای؟', 'Ready?'),
    title: text('اولین قدم را همین امروز بردار.', 'Take the first step today.'),
    button: { label: text('ثبت‌نام رایگان', 'Sign up free'), href: '/auth' },
    backgroundColor: '#6d4aff',
  },
  footer: {
    description: text(
      'LingoSpeak؛ کلاس خصوصی آنلاین زبان با مدرس‌های تأییدشده و برنامه متناسب با هدف تو.',
      'LingoSpeak: private online language lessons with verified teachers and a plan built around your goal.',
    ),
    columns: [
      {
        title: text('یادگیری', 'Learn'),
        links: [
          { label: text('زبان‌ها', 'Languages'), href: '/languages' },
          { label: text('دوره‌ها', 'Courses'), href: '/courses' },
          { label: text('تعیین سطح', 'Placement test'), href: '/placement' },
        ],
      },
      {
        title: text('آشنایی', 'Explore'),
        links: [
          { label: text('مدرس‌ها', 'Teachers'), href: '/teachers' },
          { label: text('مجله', 'Journal'), href: '/blog' },
          { label: text('درباره ما', 'About us'), href: '/about' },
        ],
      },
    ],
    phone: '0991 467 3683',
    email: 'Arezoo.ahmadi.39@gmail.com',
    address: text('تهران، ایران', 'Tehran, Iran'),
    copyright: text('تمام حقوق برای LingoSpeak محفوظ است.', 'All rights reserved by LingoSpeak.'),
  },
  sections: [
    { id: 'hero', type: 'hero', label: text('هیرو', 'Hero'), visible: true, style: {} },
    { id: 'languages', type: 'languages', label: text('زبان‌ها', 'Languages'), visible: true, style: {} },
    { id: 'benefits', type: 'benefits', label: text('مزیت‌ها', 'Benefits'), visible: true, style: {} },
    { id: 'placement', type: 'placement', label: text('تعیین سطح', 'Placement'), visible: true, style: {} },
    { id: 'courses', type: 'courses', label: text('دوره‌ها', 'Courses'), visible: true, style: {} },
    { id: 'blog', type: 'blog', label: text('مجله', 'Journal'), visible: true, style: {} },
    { id: 'faq', type: 'faq', label: text('سؤالات متداول', 'FAQ'), visible: true, style: {} },
    { id: 'finalCta', type: 'finalCta', label: text('دعوت نهایی', 'Final CTA'), visible: true, style: {} },
  ],
  theme: {
    primary: '#6d4aff',
    secondary: '#c4b5fd',
    button: '#6d4aff',
    background: '#fbfbfe',
    radius: '24px',
    shadow: '0 18px 55px rgba(48, 31, 112, 0.09)',
    containerWidth: '1240px',
    fontFamily: 'vazirmatn',
    baseFontSize: '16px',
    headingWeight: '750',
  },
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function textValue(value: unknown, fallback: LocaleText): LocaleText {
  const raw = record(value);
  return {
    fa: typeof raw.fa === 'string' ? raw.fa : fallback.fa,
    en: typeof raw.en === 'string' ? raw.en : fallback.en,
  };
}

function mergeText<T extends Record<string, unknown>>(raw: Record<string, unknown>, defaults: T): T {
  const next = { ...defaults } as Record<string, unknown>;
  Object.keys(defaults).forEach((key) => {
    const value = raw[key];
    if (key === 'label' || key === 'title' || key === 'description' || key === 'eyebrow' || key === 'question' || key === 'answer' || key === 'signIn' || key === 'signUp' || key === 'address' || key === 'copyright')
      next[key] = textValue(value, defaults[key] as LocaleText);
    else if (value !== undefined) next[key] = value;
  });
  return next as T;
}

export function normalizeLandingConfig(value: unknown): LandingConfig {
  const raw = record(value);
  const header = record(raw.header);
  const hero = record(raw.hero);
  const languages = record(raw.languages);
  const benefits = record(raw.benefits);
  const placement = record(raw.placement);
  const courses = record(raw.courses);
  const blog = record(raw.blog);
  const faq = record(raw.faq);
  const finalCta = record(raw.finalCta);
  const footer = record(raw.footer);
  const theme = record(raw.theme);

  const sections = Array.isArray(raw.sections)
    ? raw.sections
        .map((item) => {
          const itemRecord = record(item);
          const type = itemRecord.type ?? itemRecord.id;
          const defaultSection = defaultLandingConfig.sections.find((section) => section.type === type);
          if (!defaultSection || typeof type !== 'string') return null;
          return {
            ...defaultSection,
            id: typeof itemRecord.id === 'string' ? itemRecord.id : `${type}-${crypto.randomUUID()}`,
            type,
            label: textValue(itemRecord.label, defaultSection.label),
            visible: itemRecord.visible !== false,
            style: { ...defaultSection.style, ...record(itemRecord.style) },
          };
        })
        .filter(Boolean)
    : defaultLandingConfig.sections;

  const normalizedSections = [...sections] as LandingConfig['sections'];
  defaultLandingConfig.sections.forEach((section) => {
    if (!normalizedSections.some((item) => item.type === section.type)) normalizedSections.push(section);
  });

  return {
    ...defaultLandingConfig,
    brand: { ...defaultLandingConfig.brand, ...record(raw.brand) },
    header: {
      ...defaultLandingConfig.header,
      ...header,
      signIn: textValue(header.signIn, defaultLandingConfig.header.signIn),
      signUp: textValue(header.signUp, defaultLandingConfig.header.signUp),
      nav: Array.isArray(header.nav)
        ? header.nav.map((item) => {
            const itemRecord = record(item);
            return {
              id: typeof itemRecord.id === 'string' ? itemRecord.id : crypto.randomUUID(),
              label: textValue(itemRecord.label, text('منو', 'Menu')),
              href: typeof itemRecord.href === 'string' ? itemRecord.href : '/',
              visible: itemRecord.visible !== false,
            };
          })
        : defaultLandingConfig.header.nav,
    },
    hero: {
      ...defaultLandingConfig.hero,
      ...hero,
      eyebrow: textValue(hero.eyebrow, defaultLandingConfig.hero.eyebrow),
      title: textValue(hero.title, defaultLandingConfig.hero.title),
      description: textValue(hero.description, defaultLandingConfig.hero.description),
      imageAlt: textValue(hero.imageAlt, defaultLandingConfig.hero.imageAlt),
      primaryButton: mergeText(record(hero.primaryButton), defaultLandingConfig.hero.primaryButton),
      secondaryButton: mergeText(record(hero.secondaryButton), defaultLandingConfig.hero.secondaryButton),
    },
    languages: {
      ...defaultLandingConfig.languages,
      ...languages,
      eyebrow: textValue(languages.eyebrow, defaultLandingConfig.languages.eyebrow),
      title: textValue(languages.title, defaultLandingConfig.languages.title),
      description: textValue(languages.description, defaultLandingConfig.languages.description),
      cards: Array.isArray(languages.cards) ? languages.cards as LandingConfig['languages']['cards'] : defaultLandingConfig.languages.cards,
    },
    benefits: {
      ...defaultLandingConfig.benefits,
      ...benefits,
      eyebrow: textValue(benefits.eyebrow, defaultLandingConfig.benefits.eyebrow),
      title: textValue(benefits.title, defaultLandingConfig.benefits.title),
      items: Array.isArray(benefits.items) ? benefits.items as LandingConfig['benefits']['items'] : defaultLandingConfig.benefits.items,
    },
    placement: {
      ...defaultLandingConfig.placement,
      ...placement,
      eyebrow: textValue(placement.eyebrow, defaultLandingConfig.placement.eyebrow),
      title: textValue(placement.title, defaultLandingConfig.placement.title),
      description: textValue(placement.description, defaultLandingConfig.placement.description),
      button: mergeText(record(placement.button), defaultLandingConfig.placement.button),
    },
    courses: {
      ...defaultLandingConfig.courses,
      ...courses,
      eyebrow: textValue(courses.eyebrow, defaultLandingConfig.courses.eyebrow),
      title: textValue(courses.title, defaultLandingConfig.courses.title),
      description: textValue(courses.description, defaultLandingConfig.courses.description),
    },
    blog: {
      ...defaultLandingConfig.blog,
      ...blog,
      eyebrow: textValue(blog.eyebrow, defaultLandingConfig.blog.eyebrow),
      title: textValue(blog.title, defaultLandingConfig.blog.title),
      description: textValue(blog.description, defaultLandingConfig.blog.description),
    },
    faq: {
      ...defaultLandingConfig.faq,
      ...faq,
      eyebrow: textValue(faq.eyebrow, defaultLandingConfig.faq.eyebrow),
      title: textValue(faq.title, defaultLandingConfig.faq.title),
      items: Array.isArray(faq.items) ? faq.items as LandingConfig['faq']['items'] : defaultLandingConfig.faq.items,
    },
    finalCta: {
      ...defaultLandingConfig.finalCta,
      ...finalCta,
      eyebrow: textValue(finalCta.eyebrow, defaultLandingConfig.finalCta.eyebrow),
      title: textValue(finalCta.title, defaultLandingConfig.finalCta.title),
      button: mergeText(record(finalCta.button), defaultLandingConfig.finalCta.button),
    },
    footer: {
      ...defaultLandingConfig.footer,
      ...footer,
      description: textValue(footer.description, defaultLandingConfig.footer.description),
      address: textValue(footer.address, defaultLandingConfig.footer.address),
      copyright: textValue(footer.copyright, defaultLandingConfig.footer.copyright),
      columns: Array.isArray(footer.columns) ? footer.columns as LandingConfig['footer']['columns'] : defaultLandingConfig.footer.columns,
    },
    sections: normalizedSections,
    theme: normalizeTheme(theme),
  };
}

/** Theme values land in inline styles, so anything outside the known set falls back to the default. */
export function normalizeTheme(value: unknown): LandingConfig['theme'] {
  const theme = { ...defaultLandingConfig.theme, ...record(value) } as LandingConfig['theme'];
  const size = Number.parseFloat(String(theme.baseFontSize));
  return {
    ...theme,
    fontFamily: theme.fontFamily in SITE_FONTS ? theme.fontFamily : defaultLandingConfig.theme.fontFamily,
    baseFontSize: Number.isFinite(size) && size >= 14 && size <= 19 ? `${size}px` : defaultLandingConfig.theme.baseFontSize,
    headingWeight: (HEADING_WEIGHTS as readonly string[]).includes(String(theme.headingWeight)) ? String(theme.headingWeight) : defaultLandingConfig.theme.headingWeight,
  };
}

/** Site-wide typography variables consumed by globals.css. */
export function typographyStyle(theme: LandingConfig['theme']) {
  return {
    '--site-font-fa': SITE_FONTS[theme.fontFamily].stack,
    '--heading-weight': theme.headingWeight,
    fontSize: theme.baseFontSize,
  } as React.CSSProperties;
}

export function localizedText(value: LocaleText, locale: 'fa' | 'en') {
  return locale === 'en' ? value.en : value.fa;
}

export function sectionStyle(section: LandingConfig['sections'][number], theme: LandingConfig['theme']) {
  return {
    backgroundColor: section.style.backgroundColor || undefined,
    paddingBlock: section.style.padding || undefined,
    marginBlock: section.style.margin || undefined,
    borderRadius: section.style.borderRadius || undefined,
    boxShadow: section.style.shadow || undefined,
    textAlign: section.style.textAlign || undefined,
    fontSize: section.style.headingSize || undefined,
    '--section-radius': section.style.borderRadius || theme.radius,
  } as React.CSSProperties;
}

export function mediaReference(value: string) {
  return value.startsWith('media:') ? value.slice('media:'.length) : null;
}
