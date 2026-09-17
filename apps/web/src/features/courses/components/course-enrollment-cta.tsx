'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PlayCircle } from 'lucide-react';
import { api, ApiError } from '@/shared/services/api';
import { ReceiptTopUp } from '@/features/student/components/student-wallet';
import { walletService } from '@/lib/wallet-service';
import { useTranslations } from '@/components/shared/locale-provider';
import { localePath } from '@/lib/i18n';
import type { CoursePlayerPayload } from '../course-types';
export function CourseEnrollmentCta({ slug, courseId, price }: { slug: string; courseId: string; price: number }) {
  const { locale } = useTranslations(),
    english = locale === 'en',
    query = useQuery({
      queryKey: ['course-player-access', slug],
      queryFn: () => api<CoursePlayerPayload>(`/courses/${slug}/player`),
      retry: false,
    }),
    // Signed in but not enrolled: the player answers 403, so offer the receipt
    // purchase (unless a receipt for this course is already awaiting review).
    notEnrolled = query.error instanceof ApiError && query.error.status === 403,
    pendingReceipt = useQuery({
      queryKey: ['course-receipt', courseId],
      queryFn: async () =>
        (await walletService.getInvoices()).some(
          (row) => row.courseId === courseId && row.status === 'PENDING' && row.hasReceipt,
        ),
      enabled: notEnrolled,
    });
  if (notEnrolled)
    return pendingReceipt.data ? (
      <p role="status" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-800">
        {english
          ? 'Your payment receipt is awaiting review. The course unlocks once it is approved.'
          : 'رسید پرداخت شما در انتظار تأیید است. پس از تأیید، دوره فعال می‌شود.'}
      </p>
    ) : (
      <ReceiptTopUp course={{ id: courseId, price }} />
    );
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
