'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, RotateCcw, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { publicApi } from '@/shared/services/api';
import { useTranslations } from '@/components/shared/locale-provider';

type IntroVideo = { url: string; mimeType: string };

export function TeacherIntroVideoDialog({ teacherSlug, teacherName }: { teacherSlug: string; teacherName: string }) {
  const { locale } = useTranslations();
  const english = locale === 'en';
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const video = useQuery({
    queryKey: ['teacher-intro-video', teacherSlug],
    queryFn: () => publicApi<IntroVideo>(`/teachers/${encodeURIComponent(teacherSlug)}/intro-video`),
    enabled: open,
    staleTime: 4 * 60 * 1000,
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={english ? `Play ${teacherName}'s introduction video` : `پخش ویدیوی معرفی ${teacherName}`}
        className="relative grid size-16 shrink-0 place-items-center rounded-full bg-white text-purple shadow-brand"
      >
        <Play aria-hidden="true" />
      </button>
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onCancel={() => setOpen(false)}
        aria-labelledby="teacher-video-title"
        className="review-dialog"
      >
        <div className="flex items-center justify-between border-b hairline p-5">
          <h2 id="teacher-video-title" className="font-black">
            {english ? `${teacherName}'s introduction video` : `ویدیوی معرفی ${teacherName}`}
          </h2>
          <button type="button" onClick={() => setOpen(false)} aria-label={english ? 'Close video' : 'بستن ویدیو'} className="grid size-10 place-items-center rounded-xl hover:bg-canvas">
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="bg-navy p-4 sm:p-6">
          {video.isPending ? (
            <div aria-label={english ? 'Loading video' : 'در حال دریافت ویدیو'} className="skeleton aspect-video rounded-2xl" />
          ) : video.isError ? (
            <div role="alert" className="grid aspect-video place-items-center content-center gap-4 rounded-2xl bg-white p-6 text-center">
              <strong>{english ? 'The video could not be loaded' : 'ویدیو دریافت نشد'}</strong>
              <p className="text-sm text-muted">{english ? 'Check your connection and try again.' : 'اتصال خود را بررسی کنید و دوباره تلاش کنید.'}</p>
              <button type="button" onClick={() => video.refetch()} className="secondary-button">
                <RotateCcw size={17} aria-hidden="true" />
                {english ? 'Try again' : 'تلاش دوباره'}
              </button>
            </div>
          ) : (
            <video controls playsInline preload="metadata" className="aspect-video w-full rounded-2xl bg-black">
              <source src={video.data.url} type={video.data.mimeType} />
              {english ? 'Your browser cannot play this video.' : 'مرورگر شما امکان پخش این ویدیو را ندارد.'}
            </video>
          )}
        </div>
      </dialog>
    </>
  );
}
