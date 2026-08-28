'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useTranslations } from '@/components/shared/locale-provider';
import { localePath, localized, isDefaultLocale, translate } from '@/lib/i18n';

export function TeacherBookingCard({ teacherId, trialPrice }: { teacherId: string; trialPrice: number }) {
  const { locale } = useTranslations();
  const fa = isDefaultLocale(locale);
  const me = useQuery({
    queryKey: ['header-me'],
    queryFn: () => api<{ roles: string[] }>('/users/me'),
    retry: false,
  });

  if (!me.data) return null;

  const price =
    new Intl.NumberFormat(translate(locale, 'commercepricingManagerEnUS2')).format(trialPrice) +
    translate(locale, 'commercepricingManagerIrr');
  return (
    <div className="sticky top-28 rounded-4xl border hairline bg-white p-6 shadow-soft">
      <p className="text-sm text-muted">{translate(locale, 'teacherteacherBookingCardTrialLesson')}</p>
      <p className="mt-2 text-2xl font-black">{price}</p>
      <Link
        href={localePath(`/checkout?teacher=${teacherId}`, locale)}
        className="brand-gradient mt-6 block rounded-xl py-4 text-center font-black text-white"
      >
        {translate(locale, 'teacherteacherBookingCardChooseATime')}
      </Link>
      <p className="mt-5 flex gap-2 text-xs text-muted">
        <Check size={15} />
        {translate(locale, 'teacherteacherBookingCardTheCancellationPolicyIsShownBeforePayment')}
      </p>
    </div>
  );
}
