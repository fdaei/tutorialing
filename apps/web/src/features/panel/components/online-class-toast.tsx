'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Video, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/services/api';
import { useTranslations } from '@/components/shared/locale-provider';
import { localized } from '@/lib/i18n';
import { cn } from '@/shared/components/ui/cn';

type Booking = { id: string; startsAt: string; endsAt?: string | null; status: string; meetingUrl?: string | null; teacher?: { nameFa?: string; nameEn?: string } };

export function OnlineClassToast() {
  const { locale } = useTranslations();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const bookings = useQuery({ queryKey: ['bookings'], queryFn: () => api<Booking[]>('/bookings/me'), staleTime: 30_000, refetchInterval: 60_000 });
  const now = Date.now();
  const live = useMemo(() => (bookings.data ?? []).find((item) => {
    const start = new Date(item.startsAt).getTime();
    const end = item.endsAt ? new Date(item.endsAt).getTime() : start + 60 * 60 * 1000;
    return item.status === 'CONFIRMED' && Boolean(item.meetingUrl) && start <= now && now < end;
  }), [bookings.data, now]);
  const key = live ? `${live.id}:${live.startsAt}:${live.endsAt ?? ''}:${live.meetingUrl}` : null;

  useEffect(() => {
    if (!key) return;
    setDismissed(window.localStorage.getItem(`live-class-toast:${key}`));
  }, [key]);

  if (!live || !key || dismissed === key) return null;
  const teacher = localized({ fa: live.teacher?.nameFa, en: live.teacher?.nameEn }, locale) || (locale === 'en' ? 'Your instructor' : 'مدرس شما');
  return (
    <div role="status" className="fixed inset-x-4 top-20 z-50 mx-auto max-w-xl overflow-hidden rounded-2xl border border-primary/20 bg-white shadow-pop sm:inset-x-auto sm:end-6 sm:ms-auto">
      <div className="flex items-start gap-3 border-s-4 border-success bg-success/5 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success text-white"><Video size={19} /></span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 text-xs font-bold text-success"><span className="size-2 animate-pulse rounded-full bg-success" />{locale === 'en' ? 'LIVE NOW' : 'کلاس اکنون آنلاین است'}</div>
          <p className="truncate font-bold text-ink">{locale === 'en' ? 'Online class' : 'کلاس آنلاین'} · {teacher}</p>
          <a href={live.meetingUrl!} target="_blank" rel="noreferrer" className={cn('mt-3 inline-flex items-center gap-2 rounded-xl bg-ink px-3.5 py-2 text-sm font-bold text-white transition hover:bg-primary')}>
            {locale === 'en' ? 'Join class' : 'ورود به کلاس'} <ExternalLink size={15} />
          </a>
        </div>
        <button type="button" className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink" aria-label={locale === 'en' ? 'Close' : 'بستن'} onClick={() => { window.localStorage.setItem(`live-class-toast:${key}`, key); setDismissed(key); }}><X size={17} /></button>
      </div>
    </div>
  );
}
