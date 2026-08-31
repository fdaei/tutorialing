'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/services/api';
import { useTranslations } from '@/components/shared/locale-provider';
import { localePath, localized, translate } from '@/lib/i18n';

export function TeacherBookingCard({ teacherId, trialPrice }: { teacherId: string; trialPrice?: number }) {
  const { locale } = useTranslations();
  const me = useQuery({
    queryKey: ['header-me'],
    queryFn: () => api<{ roles: string[] }>('/users/me'),
    retry: false,
  });

  if (me.isPending) return <div aria-label="در حال آماده‌سازی رزرو" className="skeleton h-56 rounded-4xl" />;

  const hasApprovedPrice = typeof trialPrice === 'number' && trialPrice > 0;
  const price = hasApprovedPrice
    ? new Intl.NumberFormat(translate(locale, 'commercepricingManagerEnUS2')).format(trialPrice) +
      translate(locale, 'commercepricingManagerIrr')
    : localized({ fa: 'در حال تعیین', en: 'Pending approval' }, locale);
  const href = teacherCheckoutHref(teacherId, Boolean(me.data), locale);
  return (
    <div className="sticky top-28 rounded-4xl border hairline bg-white p-6 shadow-soft">
      <p className="text-sm text-muted">{translate(locale, 'teacherteacherBookingCardTrialLesson')}</p>
      <p className="mt-2 text-2xl font-black">{price}</p>
      {hasApprovedPrice ? (
        <Link href={href} className="brand-gradient mt-6 block rounded-xl py-4 text-center font-black text-white">
          {me.data
            ? translate(locale, 'teacherteacherBookingCardChooseATime')
            : localized({ fa: 'ورود و انتخاب زمان', en: 'Sign in to choose a time' }, locale)}
        </Link>
      ) : (
        <p className="mt-6 rounded-xl bg-slate-200 py-4 text-center font-bold text-slate-600">
          رزرو این مدرس موقتاً در دسترس نیست
        </p>
      )}
      <p className="mt-5 flex gap-2 text-xs text-muted">
        <Check size={15} />
        {translate(locale, 'teacherteacherBookingCardTheCancellationPolicyIsShownBeforePayment')}
      </p>
    </div>
  );
}

export function teacherCheckoutHref(teacherId: string, authenticated: boolean, locale: 'fa' | 'en') {
  const checkoutPath = `/checkout?teacher=${encodeURIComponent(teacherId)}`;
  return authenticated
    ? localePath(checkoutPath, locale)
    : localePath(`/auth?next=${encodeURIComponent(checkoutPath)}`, locale);
}
