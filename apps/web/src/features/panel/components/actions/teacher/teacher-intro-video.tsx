'use client';

import { translate } from '@/lib/i18n';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/services/api';
import { uploadPanelFile } from '../../../services/upload-panel-file';
import { uploadErrorMessage } from '@/shared/services/upload';
import { Localized, Shell, Status, Submit, useAction } from '../shared/action-controls';
export function TeacherIntroVideo({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint),
    application = useQuery({
      queryKey: [endpoint],
      queryFn: () => api<{ introVideoKey?: string; introVideoFileId?: string }>(endpoint),
    });
  const preview = useQuery({
    queryKey: ['teacher-intro-preview', application.data?.introVideoFileId],
    queryFn: () => api<{ url: string }>(`/files/${application.data!.introVideoFileId}/download`),
    enabled: Boolean(application.data?.introVideoFileId),
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Shell title={translate(fa, 'legacyIntroductionVideo')}>
      <p className="mt-2 text-sm leading-7 text-muted">
        {fa
          ? 'برای بررسی مهارت تدریس، یک ویدیوی کوتاه از معرفی خود و شیوه تدریستان بارگذاری کنید.'
          : 'Upload a short video introducing yourself and your teaching style for review.'}
      </p>
      <ul className="mt-3 list-inside list-disc space-y-1 rounded-xl bg-[#f5f6fa] p-4 text-sm text-muted">
        {(fa
          ? [
              'معرفی کوتاه خودتان',
              'سوابق و تخصص آموزشی',
              'نمونه‌ای کوتاه از نحوه تدریس',
              'صدای واضح و نور مناسب',
              'اطلاعات تماس شخصی را نمایش ندهید',
            ]
          : [
              'A short introduction',
              'Teaching background and expertise',
              'A brief teaching sample',
              'Clear audio and good lighting',
              'Do not show personal contact details',
            ]
        ).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="mt-3 rounded-xl bg-[#f5f6fa] p-3 text-sm">
        {application.data?.introVideoKey
          ? translate(fa, 'legacyAnIntroductionVideoIsSaved')
          : translate(fa, 'legacyNoIntroductionVideoHasBeenUploaded')}
      </p>
      {preview.data?.url && (
        <div className="mt-4 overflow-hidden rounded-2xl border hairline">
          <video controls preload="metadata" className="max-h-96 w-full bg-black" src={preview.data.url} />
          <div className="flex items-center gap-3 bg-slate-100 p-4">
            <span className="text-xs font-bold text-slate-500">01:23</span>
            <div className="relative h-2 flex-1 rounded-full bg-slate-300">
              <div className="absolute inset-y-0 start-0 w-1/3 rounded-full bg-blue"></div>
            </div>
            <span className="text-xs font-bold text-slate-500">05:00</span>
          </div>
        </div>
      )}
      <form
        className="mt-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const element = event.currentTarget,
            form = new FormData(element),
            file = form.get('file');
          if (!(file instanceof File) || !file.size) return;
          setBusy(true);
          setError('');
          try {
            const fileId = await uploadPanelFile(file, 'teacher-intro-video', fa);
            await action.mutateAsync(() =>
              api('/teacher/profile/intro-video', { method: 'PUT', body: JSON.stringify({ fileId }) }),
            );
            element.reset();
          } catch (reason) {
            setError(uploadErrorMessage(reason, translate(fa, 'legacyVideoUploadFailed')));
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          name="file"
          type="file"
          accept=".mp4,.webm,.mov"
          required
          className="w-full rounded-xl border hairline p-3"
        />
        <Submit fa={fa} busy={busy || action.isPending}>
          {translate(fa, 'legacySaveIntroductionVideo')}
        </Submit>
      </form>
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-red-800">
          {error}
        </p>
      )}
      <Status fa={fa} error={action.error} ok={action.isSuccess} />
    </Shell>
  );
}
