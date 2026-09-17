import Link from 'next/link';
import { BrandLogo, Header } from '@/components/layout/site';
import {
  ArrowUpLeft,
  ArrowUpRight,
  BarChart3,
  BadgeCheck,
  Bot,
  BookOpen,
  CalendarCheck2,
  Check,
  ChevronDown,
  Clock3,
  Headphones,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Sparkles,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  Video,
} from 'lucide-react';
import type { Course } from '@/lib/marketplace-data';
import type { EducationalLanguage } from '@/features/languages';
import type { BlogPostsPage } from '@/features/blog/types';
import type { Locale } from '@/lib/i18n';
import { localePath } from '@/lib/i18n';
import { isLinkEnabled } from '@/config';
import { defaultLandingConfig, localizedText, sectionStyle, type LandingConfig } from '../landing-config';

type LandingHomeProps = {
  config: LandingConfig;
  locale: Locale;
  languages: EducationalLanguage[];
  courses: Course[];
  posts: BlogPostsPage;
};

type LandingRenderProps = LandingHomeProps & {
  section: LandingConfig['sections'][number];
};

/** Points "forward" in the reading direction: up-left for RTL Persian, up-right for LTR English. */
function ForwardArrow({ locale, size }: { locale: Locale; size: number }) {
  const Icon = locale === 'en' ? ArrowUpRight : ArrowUpLeft;
  return <Icon size={size} aria-hidden="true" />;
}

const iconMap = { sparkles: Sparkles, target: Target, headphones: Headphones, 'bar-chart': BarChart3 };

export function LandingHome(props: LandingHomeProps) {
  const { config, locale } = props;
  return (
    <div
      className="landing-page"
      style={
        {
          '--landing-primary': config.theme.primary,
          '--landing-secondary': config.theme.secondary,
          '--landing-button': config.theme.button,
          '--landing-background': config.theme.background,
          '--landing-radius': config.theme.radius,
          '--landing-shadow': config.theme.shadow,
          '--landing-container': config.theme.containerWidth,
        } as React.CSSProperties
      }
    >
      <Header config={{ brand: config.brand, header: config.header }} />
      <main>
        {config.sections
          .filter((section) => section.visible)
          .map((section) => (
            <LandingSection key={section.id} {...props} section={section} />
          ))}
      </main>
      <LandingFooter config={config} locale={locale} />
    </div>
  );
}

function LandingSection(props: LandingRenderProps) {
  if (props.section.type === 'hero') return <HeroSection {...props} />;
  if (props.section.type === 'languages') return <LanguagesSection {...props} />;
  if (props.section.type === 'benefits') return <BenefitsSection {...props} />;
  if (props.section.type === 'placement') return <PlacementSection {...props} />;
  if (props.section.type === 'courses') return <CoursesSection {...props} />;
  if (props.section.type === 'blog') return <BlogSection {...props} />;
  if (props.section.type === 'faq') return <FaqSection {...props} />;
  return <FinalCtaSection {...props} />;
}

function HeroSection({ config, locale, section }: LandingRenderProps) {
  const english = locale === 'en';
  const t = (value: { fa: string; en: string }) => localizedText(value, locale);
  const path = (href: string) => localePath(href, locale);
  return (
    <section
      className={`landing-hero ${config.hero.imageSide === 'left' ? 'landing-hero-reversed' : ''}`}
      style={sectionStyle(section, config.theme)}
    >
      <div className="landing-container landing-hero-grid">
        <div className="landing-hero-copy">
          <span className="landing-kicker">{t(config.hero.eyebrow)}</span>
          <h1>{t(config.hero.title)}</h1>
          <p>{t(config.hero.description)}</p>
          <div className="landing-actions">
            <Link href={path(config.hero.primaryButton.href)} className="landing-button landing-button-primary">
              {t(config.hero.primaryButton.label)}
              <ForwardArrow locale={locale} size={17} />
            </Link>
            <Link href={path(config.hero.secondaryButton.href)} className="landing-button landing-button-quiet">
              {t(config.hero.secondaryButton.label)}
            </Link>
          </div>
          <div className="landing-trust-row">
            <span>
              <ShieldCheck size={16} /> {english ? 'Identity-verified teachers' : 'احراز هویت مدرس‌ها'}
            </span>
            <span>
              <CalendarCheck2 size={16} /> {english ? 'Flexible online scheduling' : 'زمان‌بندی منعطف آنلاین'}
            </span>
            <span>
              <Check size={16} /> {english ? 'Clear learning plan' : 'مسیر یادگیری شفاف'}
            </span>
          </div>
        </div>
        <div className="landing-hero-visual">
          <div className="landing-hero-image">
            <img src={config.hero.image} alt={t(config.hero.imageAlt)} />
            {config.hero.overlay > 0 && (
              <span className="landing-image-overlay" style={{ opacity: config.hero.overlay }} />
            )}
          </div>
          <div className="landing-hero-note landing-hero-note-top">
            <span className="landing-note-icon">
              <MessageCircle size={16} />
            </span>
            <span>
              <small>{english ? 'Online lessons' : 'کلاس آنلاین'}</small>
              <strong>{english ? 'One-to-one with a teacher' : 'خصوصی و یک‌به‌یک'}</strong>
            </span>
          </div>
          <div className="landing-hero-note landing-hero-note-bottom">
            <span className="landing-note-avatar">A1</span>
            <span>
              <small>{english ? 'Placement test' : 'تعیین سطح'}</small>
              <strong>{english ? 'Free, under 20 minutes' : 'رایگان، زیر ۲۰ دقیقه'}</strong>
            </span>
          </div>
          <div className="landing-hero-index">
            01 <span>/</span> 08
          </div>
        </div>
      </div>
      <div
        className="landing-container landing-proof-strip"
        aria-label={english ? 'Platform highlights' : 'ویژگی‌های کلیدی پلتفرم'}
      >
        <div>
          <strong className="latin">1:1</strong>
          <span>{english ? 'Live private lessons' : 'کلاس خصوصی زنده'}</span>
        </div>
        <div>
          <strong className="latin">A1—C2</strong>
          <span>{english ? 'CEFR-aligned paths' : 'مسیر استاندارد CEFR'}</span>
        </div>
        <div>
          <strong className="latin">20 min</strong>
          <span>{english ? 'Free level assessment' : 'تعیین سطح رایگان'}</span>
        </div>
        <div>
          <strong>
            <BadgeCheck size={24} />
          </strong>
          <span>{english ? 'Reviewed teacher profiles' : 'پروفایل مدرس بررسی‌شده'}</span>
        </div>
      </div>
    </section>
  );
}

function LanguagesSection({ config, locale, languages, section }: LandingRenderProps) {
  const english = locale === 'en';
  const t = (value: { fa: string; en: string }) => localizedText(value, locale);
  const path = (href: string) => localePath(href, locale);
  const fallbackLanguages: EducationalLanguage[] = defaultLandingConfig.languages.cards.map((card) => ({
    id: card.code,
    code: card.code,
    nameFa: card.code === 'en' ? 'انگلیسی' : card.code === 'de' ? 'آلمانی' : 'فرانسوی',
    nameEn: card.code === 'en' ? 'English' : card.code === 'de' ? 'Deutsch' : 'Français',
    nativeName: card.code === 'en' ? 'English' : card.code === 'de' ? 'Deutsch' : 'Français',
    flag: card.code === 'en' ? '🇬🇧' : card.code === 'de' ? '🇩🇪' : '🇫🇷',
    direction: 'LTR',
    active: true,
    order: 0,
    proficiencySystem: 'CEFR',
  }));
  return (
    <section className="landing-section" style={sectionStyle(section, config.theme)}>
      <div className="landing-container">
        <SectionIntro
          eyebrow={t(config.languages.eyebrow)}
          title={t(config.languages.title)}
          description={t(config.languages.description)}
        />
        <div className="landing-language-grid">
          {(languages.length ? languages.slice(0, 3) : fallbackLanguages).map((language, index) => {
            const card =
              config.languages.cards.find((item) => item.code === language.code) ?? config.languages.cards[index];
            const name = english ? language.nameEn : language.nameFa;
            return (
              <Link
                key={language.id}
                href={path(`/languages/${language.code}`)}
                className="landing-language-card"
                style={{ '--language-accent': card?.accent ?? '#ede9fe' } as React.CSSProperties}
              >
                <div className="landing-language-image">
                  <img src={language.imageUrl || card?.image || config.hero.image} alt="" />
                  <span>{language.flag || '🌐'}</span>
                </div>
                <div className="landing-language-body">
                  <div className="landing-card-heading">
                    <div>
                      <span className="landing-overline">
                        {language.proficiencySystem === 'CEFR' ? 'A1 — C2' : 'LEVELS'}
                      </span>
                      <h3>{name}</h3>
                    </div>
                    <span className="landing-language-native latin">{language.nativeName}</span>
                  </div>
                  <p>
                    {card
                      ? t(card.description)
                      : english
                        ? 'Build confidence at your pace.'
                        : 'با ریتم خودت پیشرفت کن.'}
                  </p>
                  <div className="landing-language-path" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="landing-language-meta">
                    <span>
                      <BookOpen size={14} />
                      {english ? 'Structured lessons' : 'درس‌های ساختاریافته'}
                    </span>
                    <span>
                      <TrendingUp size={14} />
                      {english ? 'Progress tracking' : 'پیگیری پیشرفت'}
                    </span>
                  </div>
                  <span className="landing-inline-link">
                    {english ? 'Build my learning path' : 'ساخت مسیر یادگیری من'}{' '}
                    <ForwardArrow locale={locale} size={15} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BenefitsSection({ config, locale, section }: LandingRenderProps) {
  const english = locale === 'en';
  const t = (value: { fa: string; en: string }) => localizedText(value, locale);
  const items = [
    ...config.benefits.items,
    {
      icon: 'bot',
      title: { fa: 'دستیار تمرین هوشمند', en: 'AI practice assistance' },
      description: {
        fa: 'بین جلسه‌ها با تمرین‌های هدفمند، بازخورد سریع و مرور متناسب با مسیرت جلو برو.',
        en: 'Keep moving between lessons with focused practice, fast feedback, and reviews shaped around your path.',
      },
    },
  ];
  return (
    <section className="landing-section landing-section-tint" style={sectionStyle(section, config.theme)}>
      <div className="landing-container">
        <SectionIntro eyebrow={t(config.benefits.eyebrow)} title={t(config.benefits.title)} />
        <div className="landing-benefit-grid">
          {items.map((item, index) => {
            const Icon = item.icon === 'bot' ? Bot : (iconMap[item.icon as keyof typeof iconMap] ?? Sparkles);
            return (
              <article
                key={`${item.title.en}-${index}`}
                className={`landing-benefit-item ${index === 0 ? 'landing-benefit-featured' : ''}`}
              >
                <span className="landing-benefit-icon">
                  <Icon size={20} />
                </span>
                <span className="landing-overline">0{index + 1}</span>
                <h3>{t(item.title)}</h3>
                <p>{t(item.description)}</p>
              </article>
            );
          })}
        </div>
        <div className="landing-learning-story">
          <div className="landing-story-copy">
            <span className="landing-kicker">{english ? 'One connected experience' : 'یک تجربه یکپارچه'}</span>
            <h3>
              {english
                ? 'From “where do I start?” to a plan you can follow.'
                : 'از «از کجا شروع کنم؟» تا برنامه‌ای که می‌توانی ادامه بدهی.'}
            </h3>
            <p>
              {english
                ? 'Assessment, expert guidance, live speaking practice and progress feedback work together—so every session has a clear next step.'
                : 'تعیین سطح، راهنمایی مدرس، تمرین زنده مکالمه و بازخورد پیشرفت کنار هم کار می‌کنند؛ بنابراین بعد از هر جلسه قدم بعدی روشن است.'}
            </p>
          </div>
          <ol className="landing-journey-steps">
            <li>
              <span>01</span>
              <div>
                <strong>{english ? 'Know your level' : 'سطحت را بشناس'}</strong>
                <small>{english ? 'Free CEFR assessment' : 'سنجش رایگان CEFR'}</small>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>{english ? 'Meet your teacher' : 'مدرست را انتخاب کن'}</strong>
                <small>{english ? 'Goals, schedule and fit' : 'بر اساس هدف و زمان تو'}</small>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>{english ? 'Practise and improve' : 'تمرین کن و پیشرفتت را ببین'}</strong>
                <small>{english ? 'Live practice with feedback' : 'تمرین زنده همراه بازخورد'}</small>
              </div>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}

function PlacementSection({ config, locale, section }: LandingRenderProps) {
  const t = (value: { fa: string; en: string }) => localizedText(value, locale);
  const path = (href: string) => localePath(href, locale);
  return (
    <section className="landing-section" style={sectionStyle(section, config.theme)}>
      <div className="landing-container">
        <div className="landing-placement" style={{ backgroundColor: config.placement.backgroundColor }}>
          <div className="landing-placement-copy">
            <span className="landing-kicker landing-kicker-light">{t(config.placement.eyebrow)}</span>
            <h2>{t(config.placement.title)}</h2>
            <p>{t(config.placement.description)}</p>
            <Link href={path(config.placement.button.href)} className="landing-button landing-button-light">
              {t(config.placement.button.label)} <ForwardArrow locale={locale} size={17} />
            </Link>
          </div>
          <div className="landing-placement-art">
            <img src={config.placement.image} alt="" />
            <div className="landing-level-stack">
              <span>A1</span>
              <span>B1</span>
              <span>C1</span>
            </div>
            <div className="landing-placement-stamp">
              <Target size={17} />
              <span>
                CEFR
                <br />
                <strong>A1—C2</strong>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CoursesSection({ config, locale, courses, section }: LandingRenderProps) {
  const english = locale === 'en';
  const t = (value: { fa: string; en: string }) => localizedText(value, locale);
  const path = (href: string) => localePath(href, locale);
  const courseItems = courses.slice(0, 4);
  return (
    <section className="landing-section" style={sectionStyle(section, config.theme)}>
      <div className="landing-container">
        <SectionIntro
          eyebrow={t(config.courses.eyebrow)}
          title={t(config.courses.title)}
          description={t(config.courses.description)}
        />
        {courseItems.length > 0 && (
          <div className="landing-course-grid">
            {courseItems.map((course) => {
              const title = english ? course.titleEn : course.titleFa;
              return (
                <Link href={path(`/courses/${course.slug}`)} key={course.slug} className="landing-course-card">
                  <div className="landing-course-image">
                    {course.image ? (
                      <img src={course.image} alt="" />
                    ) : (
                      <span className="landing-course-placeholder">
                        <BookGlyph />
                      </span>
                    )}
                    <span className="landing-course-level">{course.level}</span>
                  </div>
                  <div className="landing-course-content">
                    <div className="landing-course-topline">
                      <span className="landing-overline">{course.language}</span>
                      <span>
                        {course.delivery === 'online' ? <Video size={14} /> : null}
                        {english ? 'Online' : 'آنلاین'}
                      </span>
                    </div>
                    <h3>{title}</h3>
                    <p>{english ? course.descriptionEn : course.descriptionFa}</p>
                    <div className="landing-course-meta">
                      <span>
                        <Clock3 size={14} />{' '}
                        {(course.lessonsCount ?? course.lessons ?? 0).toLocaleString(english ? 'en-US' : 'fa-IR')}{' '}
                        {english ? 'lessons' : 'جلسه'}
                      </span>
                      <strong>
                        {course.price.toLocaleString(english ? 'en-US' : 'fa-IR')} {english ? 'Toman' : 'تومان'}
                      </strong>
                    </div>
                    <span className="landing-course-cta">
                      {english ? 'View course details' : 'مشاهده جزئیات دوره'}{' '}
                      <ForwardArrow locale={locale} size={15} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        <div className="landing-section-link-wrap">
          <Link href={path('/courses')} className="landing-text-link">
            {english ? 'View all courses' : 'مشاهده همه دوره‌ها'} <ForwardArrow locale={locale} size={16} />
          </Link>
        </div>
        <TrustConversion locale={locale} />
      </div>
    </section>
  );
}

function TrustConversion({ locale }: { locale: Locale }) {
  const english = locale === 'en';
  const path = (href: string) => localePath(href, locale);
  const teacherDiscovery = isLinkEnabled('/teachers');
  return (
    <section className="landing-trust-panel" aria-labelledby="trust-panel-title">
      <div className="landing-trust-panel-copy">
        <span className="landing-kicker">{english ? 'Built for trust' : 'انتخاب با خیال راحت'}</span>
        <h3 id="trust-panel-title">
          {english
            ? 'A real teacher, a clear plan, and support when you need it.'
            : 'مدرس واقعی، برنامه روشن و پشتیبانی هر وقت نیازش داری.'}
        </h3>
        <p>
          {english
            ? 'Teacher profiles are reviewed before publishing. Compare specialties and course formats, then choose the path that fits your goal.'
            : 'پروفایل مدرس‌ها پیش از انتشار بررسی می‌شود. تخصص‌ها و مدل دوره‌ها را مقایسه کن و مسیری را بردار که با هدفت هماهنگ است.'}
        </p>
        <div className="landing-trust-checks">
          <span>
            <ShieldCheck size={17} />
            {english ? 'Identity and documents reviewed' : 'بررسی هویت و مدارک'}
          </span>
          <span>
            <CalendarCheck2 size={17} />
            {english ? 'Transparent scheduling' : 'زمان‌بندی شفاف'}
          </span>
          <span>
            <Headphones size={17} />
            {english ? 'Human support' : 'پشتیبانی انسانی'}
          </span>
        </div>
        <Link
          href={path(teacherDiscovery ? '/teachers' : '/courses')}
          className="landing-button landing-button-primary"
        >
          {teacherDiscovery
            ? english
              ? 'Meet the teachers'
              : 'آشنایی با مدرس‌ها'
            : english
              ? 'Explore learning options'
              : 'مشاهده مسیرهای یادگیری'}
          <ForwardArrow locale={locale} size={17} />
        </Link>
      </div>
      <div
        className="landing-teacher-stack"
        aria-label={english ? 'Expert teacher profiles' : 'پروفایل مدرس‌های متخصص'}
      >
        <article>
          <div className="landing-teacher-avatar">AA</div>
          <div>
            <span>
              <BadgeCheck size={16} />
              {english ? 'Verified teacher' : 'مدرس تأییدشده'}
            </span>
            <strong>{english ? 'Arezoo Ahmadi' : 'آرزو احمدی'}</strong>
            <small>{english ? 'General English · IELTS' : 'انگلیسی عمومی · آیلتس'}</small>
          </div>
        </article>
        <article>
          <div className="landing-teacher-avatar landing-teacher-avatar-alt">SS</div>
          <div>
            <span>
              <BadgeCheck size={16} />
              {english ? 'Verified teacher' : 'مدرس تأییدشده'}
            </span>
            <strong>{english ? 'Shahriar Shahfar' : 'شهریار شهفر'}</strong>
            <small>{english ? 'Conversation · Academic English' : 'مکالمه · انگلیسی آکادمیک'}</small>
          </div>
        </article>
        <div className="landing-teacher-result">
          <TrendingUp size={22} />
          <div>
            <strong>{english ? 'Progress you can see' : 'پیشرفتی که می‌بینی'}</strong>
            <span>
              {english ? 'Goals, sessions and next steps in one place' : 'هدف‌ها، جلسه‌ها و قدم بعدی در یک پنل'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function BlogSection({ config, locale, posts, section }: LandingRenderProps) {
  const english = locale === 'en';
  const t = (value: { fa: string; en: string }) => localizedText(value, locale);
  const path = (href: string) => localePath(href, locale);
  const postItems = posts.items.slice(0, 3);
  if (!postItems.length) return null;
  return (
    <section className="landing-section landing-section-tint" style={sectionStyle(section, config.theme)}>
      <div className="landing-container">
        <SectionIntro
          eyebrow={t(config.blog.eyebrow)}
          title={t(config.blog.title)}
          description={t(config.blog.description)}
        />
        <div className="landing-blog-grid">
          {postItems.map((post) => (
            <Link href={path(`/blog/${post.slug}`)} className="landing-blog-card" key={post.slug}>
              <div className="landing-blog-image">
                {post.coverImage ? (
                  <img src={post.coverImage} alt="" />
                ) : (
                  <span>
                    <Sparkles size={22} />
                  </span>
                )}
              </div>
              <div className="landing-blog-content">
                <span className="landing-overline">
                  {english ? (post.category?.nameEn ?? 'Learning') : (post.category?.nameFa ?? 'یادگیری')}
                </span>
                <h3>{english ? post.titleEn : post.titleFa}</h3>
                <p>{english ? post.excerptEn : post.excerptFa}</p>
                <span className="landing-inline-link">
                  {english ? 'Read article' : 'مطالعه مقاله'} <ForwardArrow locale={locale} size={15} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection({ config, locale, section }: LandingRenderProps) {
  const t = (value: { fa: string; en: string }) => localizedText(value, locale);
  return (
    <section className="landing-section landing-faq-section" style={sectionStyle(section, config.theme)}>
      <div className="landing-container landing-faq-layout">
        <SectionIntro eyebrow={t(config.faq.eyebrow)} title={t(config.faq.title)} />
        <div className="landing-faq-list">
          {config.faq.items.map((item, index) => (
            <details key={`${item.question.en}-${index}`} open={index === 0}>
              <summary>
                {t(item.question)} <ChevronDown size={18} />
              </summary>
              <p>{t(item.answer)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCtaSection({ config, locale, section }: LandingRenderProps) {
  const t = (value: { fa: string; en: string }) => localizedText(value, locale);
  const path = (href: string) => localePath(href, locale);
  return (
    <section className="landing-section landing-final-section" style={sectionStyle(section, config.theme)}>
      <div className="landing-container">
        <div className="landing-final-cta" style={{ backgroundColor: config.finalCta.backgroundColor }}>
          <div>
            <span className="landing-kicker landing-kicker-light">{t(config.finalCta.eyebrow)}</span>
            <h2>{t(config.finalCta.title)}</h2>
          </div>
          <Link href={path(config.finalCta.button.href)} className="landing-button landing-button-light">
            {t(config.finalCta.button.label)} <ForwardArrow locale={locale} size={17} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function SectionIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="landing-section-intro">
      <span className="landing-kicker">{eyebrow}</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}

function LandingFooter({ config, locale }: { config: LandingConfig; locale: Locale }) {
  const english = locale === 'en';
  const path = (href: string) => localePath(href, locale);
  const t = (value: { fa: string; en: string }) => localizedText(value, locale);
  return (
    <footer className="landing-footer">
      <div className="landing-container landing-footer-grid">
        <div className="landing-footer-brand">
          <Link href={path('/')} className="landing-brand">
            <BrandLogo name={config.brand.name} src={config.brand.logo} />
          </Link>
          <p>{t(config.footer.description)}</p>
          <div className="landing-socials">
            <a href={`tel:${config.footer.phone}`} aria-label={english ? 'Phone' : 'تلفن'}>
              <Phone size={16} />
            </a>
            <a href={`mailto:${config.footer.email}`} aria-label={english ? 'Email' : 'ایمیل'}>
              <Mail size={16} />
            </a>
            <a href={path('/contact')} aria-label={english ? 'Contact' : 'تماس'}>
              <MessageCircle size={16} />
            </a>
          </div>
        </div>
        {config.footer.columns.map((column) => (
          <div key={column.title.en}>
            <h3>{t(column.title)}</h3>
            <div className="landing-footer-links">
              {column.links
                .filter((link) => isLinkEnabled(link.href))
                .map((link) => (
                  <Link href={path(link.href)} key={link.href}>
                    {t(link.label)}
                  </Link>
                ))}
            </div>
          </div>
        ))}
        <div className="landing-footer-contact">
          <h3>{english ? 'Contact' : 'تماس با ما'}</h3>
          <p>
            <Phone size={15} /> {config.footer.phone}
          </p>
          <p>
            <Mail size={15} /> {config.footer.email}
          </p>
          <p>
            <MapPin size={15} /> {t(config.footer.address)}
          </p>
          <p>
            <Users size={15} /> {english ? 'Office hours 10:00–17:00' : 'ساعت کاری ۱۰ صبح تا ۵ عصر'}
          </p>
        </div>
      </div>
      <div className="landing-container landing-footer-bottom">
        <span>
          © {english ? '2026' : '۱۴۰۵'} {config.brand.name}
        </span>
        <span>{t(config.footer.copyright)}</span>
      </div>
    </footer>
  );
}

function BookGlyph() {
  return (
    <span aria-hidden="true" className="landing-book-glyph">
      LS
    </span>
  );
}
