'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PlayCircle } from 'lucide-react';
import { api } from '@/shared/services/api';
import { useTranslations } from '@/components/shared/locale-provider';
import { localePath } from '@/lib/i18n';
import type { CoursePlayerPayload } from '../course-types';
export function CourseEnrollmentCta({ slug }: { slug: string }) {
  const { locale } = useTranslations(),
    english = locale === 'en',
    query = useQuery({
      queryKey: ['course-player-access', slug],
      queryFn: () => api<CoursePlayerPayload>(`/courses/${slug}/player`),
      retry: false,
    });
  if (query.data)
    return (
      <Link
        href={localePath(`/courses/${slug}/learn`, locale)}
        className="brand-gradient mt-4 flex min-h-13 items-center justify-center gap-2 rounded-xl font-black text-white"
      >
        <PlayCircle size={19} />
        {query.data.progressPercent
          ? english
            ? 'Resume learning'
            : 'ادامه یادگیری'
          : english
            ? 'Start course'
            : 'شروع دوره'}
      </Link>
    );
  return (
    <Link
      href={`${localePath('/auth', locale)}?next=${encodeURIComponent(localePath(`/courses/${slug}`, locale))}`}
      className="brand-gradient mt-4 flex min-h-13 items-center justify-center rounded-xl font-black text-white"
    >
      {query.isLoading
        ? english
          ? 'Checking enrollment…'
          : 'بررسی وضعیت ثبت‌نام…'
        : english
          ? 'Sign in to enroll'
          : 'ورود و ثبت‌نام در دوره'}
    </Link>
  );
}
