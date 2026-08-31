'use client';
import Link from 'next/link';
import { BadgeCheck, Star, UserRound } from 'lucide-react';
import type { PublicTeacher } from '../types/public-teacher';
import { api } from '@/shared/services/api';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from '@/components/shared/locale-provider';
import { localePath, localized, translate } from '@/lib/i18n';

export function TeacherCard({ teacher, reason, score }: { teacher: PublicTeacher; reason?: string; score?: number }) {
  const me = useQuery({
    queryKey: ['header-me'],
    queryFn: () => api<{ roles: string[] }>('/users/me'),
    retry: false,
  });
  const { locale } = useTranslations(),
    initials = teacher.nameEn
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2),
    money =
      new Intl.NumberFormat(translate(locale, 'commercepricingManagerEnUS2')).format(teacher.approvedTrialPrice ?? 0) +
      translate(locale, 'commercepricingManagerIrr');
  return (
    <article className="surface-card lift relative overflow-hidden p-5">
      {score != null && (
        <span className="absolute start-4 top-4 z-10 rounded-full bg-lavender px-3 py-1 text-xs font-black text-purple">
          {score}% {translate(locale, 'teacherteacherCardMatch')}
        </span>
      )}
      <div className="flex items-start gap-4">
        <div className="relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-[20px] bg-gradient-to-br from-[#e7ecff] to-[#eee7ff]">
          <UserRound size={46} className="text-purple/55" />
          <span className="latin absolute bottom-2 text-xs font-black text-navy/50">{initials}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-lg font-black">
            {localized({ fa: teacher.nameFa, en: teacher.nameEn }, locale)}
            <BadgeCheck size={18} className="text-blue" />
          </h3>
          <p className="mt-1 truncate text-xs text-muted">
            {localized({ fa: teacher.nameEn, en: teacher.nameFa }, locale)}
          </p>
          <p className="mt-3 flex items-center gap-1 text-sm font-bold">
            <Star size={15} fill="#f5a623" className="text-[#f5a623]" />
            {teacher.reviewsCount ? (
              <>
                <span className="latin">{teacher.rating.toFixed(1)}</span>
                <span className="font-normal text-muted">
                  {teacher.reviewsCount.toLocaleString(locale === 'en' ? 'en-US' : 'fa-IR')} {locale === 'en' ? 'reviews' : 'نظر'}
                </span>
              </>
            ) : (
              <span className="font-normal text-muted">{locale === 'en' ? 'No ratings yet' : 'هنوز امتیازی ثبت نشده'}</span>
            )}
          </p>
        </div>
      </div>
      <p className="mt-5 line-clamp-2 min-h-14 text-sm leading-7 text-muted">
        {localized({ fa: teacher.bioFa, en: teacher.bioEn ?? teacher.bioFa }, locale)}
      </p>
      {reason && <p className="mt-4 rounded-xl bg-lavender p-3 text-xs font-bold text-purple">{reason}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {teacher.specialties.slice(0, 3).map((s) => (
          <span key={s} className="latin rounded-full bg-[#f4f5f8] px-3 py-1 text-[11px] text-muted">
            {s}
          </span>
        ))}
      </div>
      <div className={`mt-5 flex items-end border-t hairline pt-5 ${me.data ? 'justify-between' : 'justify-end'}`}>
        {me.data && (
          <div>
            <p className="text-xs text-muted">{translate(locale, 'teacherteacherBookingCardTrialLesson')}</p>
            <p className="mt-1 font-black text-blue">{money}</p>
          </div>
        )}
        <Link
          href={localePath(`/teachers/${teacher.slug}`, locale)}
          className="rounded-xl border border-blue px-4 py-2.5 text-sm font-bold text-blue hover:bg-blue hover:text-white"
        >
          {translate(locale, 'teacherteacherCardViewBook')}
        </Link>
      </div>
    </article>
  );
}
