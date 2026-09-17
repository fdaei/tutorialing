'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Check, PlayCircle } from 'lucide-react';
import { api, ApiError, publicApi } from '@/shared/services/api';
import { ReceiptTopUp } from '@/features/student/components/student-wallet';
import { walletService } from '@/lib/wallet-service';
import { useTranslations } from '@/components/shared/locale-provider';
import { localePath } from '@/lib/i18n';
import type { CoursePlayerPayload } from '../course-types';
type Slot = { startsAt: string; endsAt: string; date: string; timezone: string; type: 'trial' | 'regular' };

export function CourseEnrollmentCta({
  slug,
  courseId,
  price,
  format,
  teacherId,
  sessionsCount,
}: {
  slug: string;
  courseId: string;
  price: number;
  format?: 'SELF_PACED' | 'LIVE_ONLINE';
  teacherId?: string | null;
  sessionsCount: number;
}) {
  const [selected, setSelected] = useState<Slot[]>([]);
  const ranges = useMemo(() => {
    const from = new Date();
    from.setSeconds(0, 0);
    const middle = new Date(from.getTime() + 30 * 86_400_000);
    const to = new Date(from.getTime() + 60 * 86_400_000);
    return [
      { from: from.toISOString(), to: middle.toISOString() },
      { from: middle.toISOString(), to: to.toISOString() },
    ];
  }, []);
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
    }),
    slots = useQuery({
      queryKey: ['course-slots', teacherId, ranges],
      queryFn: async () => {
        const chunks = await Promise.all(
          ranges.map(({ from, to }) =>
            publicApi<Slot[]>(
              `/availability/${teacherId}/slots?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&type=regular`,
            ),
          ),
        );
        return [...new Map(chunks.flat().map((slot) => [slot.startsAt, slot])).values()].sort((a, b) =>
          a.startsAt.localeCompare(b.startsAt),
        );
      },
      enabled: notEnrolled && format === 'LIVE_ONLINE' && Boolean(teacherId) && !pendingReceipt.data,
    });
  if (notEnrolled)
    return pendingReceipt.data ? (
      <p role="status" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-800">
        {english
          ? 'Your payment receipt is awaiting review. The course unlocks once it is approved.'
          : 'رسید پرداخت شما در انتظار تأیید است. پس از تأیید، دوره فعال می‌شود.'}
      </p>
    ) : format === 'LIVE_ONLINE' ? (
      <div className="mt-5">
        <div className="rounded-2xl border hairline p-4">
          <div className="flex items-center gap-2 font-black">
            <CalendarDays size={19} />
            {english ? 'Choose your class times' : 'انتخاب نوبت‌های کلاس'}
          </div>
          <p className="mt-2 text-xs leading-6 text-muted">
            {english
              ? `Choose ${sessionsCount} available times from the teacher before uploading your receipt.`
              : `پیش از بارگذاری فیش، ${sessionsCount.toLocaleString('fa-IR')} نوبت از زمان‌های آزاد مدرس انتخاب کنید.`}
          </p>
          {slots.isLoading ? <div className="skeleton mt-4 h-24 rounded-xl" /> : null}
          {slots.isError ? (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {english ? 'Available times could not be loaded.' : 'دریافت زمان‌های آزاد مدرس ناموفق بود.'}
            </p>
          ) : null}
          {slots.data && !slots.data.length ? (
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              {english
                ? 'The teacher has no available times right now.'
                : 'در حال حاضر نوبت آزادی برای این مدرس ثبت نشده است.'}
            </p>
          ) : null}
          <div className="mt-4 grid max-h-64 gap-2 overflow-auto sm:grid-cols-2">
            {slots.data?.map((slot) => {
              const active = selected.some((item) => item.startsAt === slot.startsAt);
              return (
                <button
                  type="button"
                  key={slot.startsAt}
                  onClick={() =>
                    setSelected((current) =>
                      active
                        ? current.filter((item) => item.startsAt !== slot.startsAt)
                        : current.length < sessionsCount
                          ? [...current, slot]
                          : current,
                    )
                  }
                  className={`flex items-center justify-between rounded-xl border px-3 py-3 text-xs font-bold ${active ? 'border-indigo-600 bg-indigo-50 text-indigo-800' : 'hairline bg-white'}`}
                >
                  <span>
                    {new Intl.DateTimeFormat(english ? 'en-US' : 'fa-IR', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(slot.startsAt))}
                  </span>
                  {active ? <Check size={16} /> : null}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs font-bold text-muted">
            {english
              ? `${selected.length} of ${sessionsCount} selected`
              : `${selected.length.toLocaleString('fa-IR')} از ${sessionsCount.toLocaleString('fa-IR')} نوبت انتخاب شده`}
          </p>
        </div>
        {selected.length === sessionsCount ? (
          <ReceiptTopUp
            course={{ id: courseId, price }}
            sessions={selected.map(({ startsAt, endsAt, timezone }) => ({ startsAt, endsAt, timezone }))}
          />
        ) : null}
      </div>
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
