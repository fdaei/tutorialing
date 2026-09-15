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
  };
};

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
    signUp: text('ثبت‌نام', 'Get started'),
  },
  hero: {
    eyebrow: text('یادگیری زبان، با ریتم زندگی شما', 'Language learning, shaped around your life'),
    title: text('برای حرف‌زدن آماده شو، نه فقط حفظ‌کردن.', 'Learn to speak, not just memorize.'),
    description: text(
      'با مدرس‌های تأییدشده، مسیر یادگیری شخصی و دوره‌هایی که به هدف واقعی شما وصل‌اند.',
      'Meet verified teachers, follow a personal learning route, and choose courses that connect to a real goal.',
    ),
    primaryButton: { label: text('شروع یادگیری', 'Start learning'), href: '/languages' },
    secondaryButton: { label: text('تعیین سطح رایگان', 'Free placement test'), href: '/placement' },
    image: '/images/lingospeak-student.png',
    imageAlt: text('زبان‌آموز در حال یادگیری با لپ‌تاپ', 'A language learner studying with a laptop'),
    imageSide: 'right',
    overlay: 0,
  },
  languages: {
    eyebrow: text('زبان بعدی شما', 'Your next language'),
    title: text('یک زبان انتخاب کن، یک دنیای تازه باز می‌شود.', 'Choose a language. Open a new world.'),
    description: text(
      'از اولین جمله تا مکالمه‌ای که با اعتمادبه‌نفس انجام می‌دهی، مسیرت را قدم‌به‌قدم می‌سازی.',
      'From your first sentence to confident conversation, build your route one useful step at a time.',
    ),
    cards: [
      {
        code: 'en',
        image: '/images/lingospeak-student.png',
        accent: '#ede9fe',
        description: text('برای کار، سفر و گفت‌وگوی روزمره.', 'For work, travel, and everyday conversation.'),
      },
      {
        code: 'de',
        image: '/images/auth/register.png',
        accent: '#dcfce7',
        description: text('ساختن آینده‌ای تازه با Deutsch.', 'Build your next chapter with Deutsch.'),
      },
      {
        code: 'fr',
        image: '/images/auth/login.png',
        accent: '#fee2e2',
        description: text('زبان فرهنگ، سفر و فرصت‌های تازه.', 'The language of culture, travel, and possibility.'),
      },
    ],
  },
  benefits: {
    eyebrow: text('چرا LingoSpeak', 'The LingoSpeak difference'),
    title: text('کمک می‌کنیم یادگیری، بخشی از زندگی‌ات شود.', 'We make learning feel like part of life.'),
    items: [
      {
        icon: 'sparkles',
        title: text('آموزش کاربردی', 'Practical learning'),
        description: text('هر درس به موقعیتی وصل است که واقعاً در زندگی استفاده می‌کنی.', 'Every lesson connects to a situation you will actually use.'),
      },
      {
        icon: 'target',
        title: text('برنامه شخصی', 'A personal route'),
        description: text('هدف، سطح و زمان تو، مسیر یادگیری را شکل می‌دهد.', 'Your goal, level, and schedule shape the route.'),
      },
      {
        icon: 'headphones',
        title: text('پشتیبانی انسانی', 'Human support'),
        description: text('هرجا لازم باشد، یک نفر کنار توست تا انتخاب بعدی روشن باشد.', 'When you need it, a real person helps you choose what comes next.'),
      },
      {
        icon: 'bar-chart',
        title: text('پیشرفت قابل دیدن', 'Visible progress'),
        description: text('بدانی کجا هستی، چه چیزی بهتر شده و قدم بعدی چیست.', 'Know where you are, what improved, and what comes next.'),
      },
    ],
  },
  placement: {
    eyebrow: text('رایگان و استاندارد', 'Free and CEFR-aligned'),
    title: text('از نقطه درست شروع کن.', 'Start at the right level.'),
    description: text(
      'در کمتر از ۲۰ دقیقه سطح فعلی‌ات را بشناس و پیشنهادی متناسب با هدف خودت بگیر.',
      'Find your current level in under 20 minutes and get a route matched to your goal.',
    ),
    button: { label: text('شروع آزمون تعیین سطح', 'Take the placement test'), href: '/placement' },
    image: '/images/lingospeak-student.png',
    backgroundColor: '#241b51',
  },
  courses: {
    eyebrow: text('دوره‌های منتخب', 'Curated courses'),
    title: text('برای هدفی که همین امروز داری.', 'Built for the goal you have today.'),
    description: text('دوره‌ای را انتخاب کن که با سطح، زمان و نتیجه‌ای که می‌خواهی هماهنگ باشد.', 'Choose a course that matches your level, time, and the result you want.'),
  },
  blog: {
    eyebrow: text('از مجله یادگیری', 'From the learning journal'),
    title: text('چیزهایی که یادگیری را ساده‌تر می‌کنند.', 'Small ideas that make learning easier.'),
    description: text('نکته‌ها و راهنمایی‌های کوتاه برای اینکه بین جلسات هم پیشرفت کنی.', 'Short, useful ideas to keep making progress between lessons.'),
  },
  faq: {
    eyebrow: text('پرسش‌های متداول', 'Frequently asked'),
    title: text('قبل از شروع، خیالت راحت باشد.', 'Feel clear before you begin.'),
    items: [
      {
        question: text('چطور مسیر مناسبم را پیدا کنم؟', 'How do I find the right route?'),
        answer: text('با تعیین سطح شروع کن، هدف و زمانت را مشخص کن و از پیشنهادهای دوره و مدرس استفاده کن.', 'Start with placement, add your goal and schedule, then use the suggested teachers and courses.'),
      },
      {
        question: text('آیا مدرس‌ها بررسی شده‌اند؟', 'Are teachers verified?'),
        answer: text('بله. مدارک، سابقه و اطلاعات مدرس‌ها پیش از نمایش عمومی بررسی می‌شود.', 'Yes. Teacher identity, experience, and submitted documents are reviewed before profiles go public.'),
      },
      {
        question: text('کلاس‌ها آنلاین هستند؟', 'Are lessons online?'),
        answer: text('بله، کلاس‌ها آنلاین‌اند و زمان آن‌ها بر اساس منطقه زمانی شما نمایش داده می‌شود.', 'Yes. Lessons are online, with available times shown in your time zone.'),
      },
      {
        question: text('اگر سوال داشته باشم چه؟', 'What if I have a question?'),
        answer: text('پشتیبانی لینگواسپیک از طریق تیکت و راه‌های تماس درج‌شده در فوتر پاسخ‌گوست.', 'LingoSpeak support is available through tickets and the contact details in the footer.'),
      },
    ],
  },
  finalCta: {
    eyebrow: text('قدم بعدی تو', 'Your next step'),
    title: text('با یک زبان جدید، دنیای جدیدی بساز.', 'Build a new world with a new language.'),
    button: { label: text('شروع کن', 'Get started'), href: '/auth' },
    backgroundColor: '#6d4aff',
  },
  footer: {
    description: text(
      'یک مسیر روشن برای یادگیری زبان، با انتخاب‌های انسانی و پیشرفت واقعی.',
      'A clear route to language learning, with human choices and visible progress.',
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
    theme: { ...defaultLandingConfig.theme, ...theme },
  };
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
