import Link from 'next/link';
import { Bell, BookOpen, Headphones, Settings, Star } from 'lucide-react';
import { localePath, localized, isDefaultLocale, translate } from '@/lib/i18n';

export function TeacherMore({ locale }: { locale: 'fa' | 'en' }) {
  const fa = isDefaultLocale(locale),
    items = [
      [
        '/teacher-panel/plans',
        BookOpen,
        translate(locale, 'teacherteacherMoreAssignmentsPlans'),
        translate(locale, 'teacherteacherMoreCreatePlansAndAssignments'),
      ],
      [
        '/teacher-panel/reviews',
        Star,
        translate(locale, 'teacherteacherMoreReviewsRatings'),
        translate(locale, 'teacherteacherMoreReadStudentFeedback'),
      ],
      [
        '/teacher-panel/tickets',
        Headphones,
        translate(locale, 'teacherteacherMoreSupport'),
        translate(locale, 'teacherteacherMoreCreateOrFollowUpARequest'),
      ],
      [
        '/teacher-panel/notifications',
        Bell,
        translate(locale, 'teacherteacherMoreNotifications'),
        translate(locale, 'teacherteacherMoreReviewImportantAccountEvents'),
      ],
      [
        '/teacher-panel/settings',
        Settings,
        translate(locale, 'teacherteacherMoreAccountSettings'),
        translate(locale, 'teacherteacherMoreViewBasicAccountDetails'),
      ],
    ] as const;
  return (
    <div>
      <header>
        <p className="mb-2 text-sm font-bold text-blue">{translate(locale, 'teacherteacherMoreAdditionalTools')}</p>
        <h1 className="text-3xl font-black">{translate(locale, 'teacherteacherMoreMore')}</h1>
        <p className="mt-2 text-muted">
          {translate(locale, 'teacherteacherMoreLessFrequentToolsOrganizedAndAccessible')}
        </p>
      </header>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(([href, Icon, title, text]) => (
          <Link key={href} href={localePath(href, locale)} className="panel-card lift flex gap-4 p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Icon size={21} />
            </span>
            <span>
              <strong className="block">{title}</strong>
              <small className="mt-1 block leading-6 text-muted">{text}</small>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
