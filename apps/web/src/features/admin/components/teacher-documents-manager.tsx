'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { localized } from '@/lib/i18n';
import { api, apiMessage } from '@/shared/services/api';
import { useTranslations } from '@/components/shared/locale-provider';

type VerificationItem = {
  id: string;
  kind: string;
  status: string;
  note?: string | null;
  file: { id: string; originalName: string; mimeType: string; size: number };
};
type Application = {
  id: string;
  nameFa: string;
  nameEn: string;
  user?: { phone?: string };
  verificationItems: VerificationItem[];
};

export function TeacherDocumentsManager() {
  const { locale } = useTranslations();
  const query = useQuery({
    queryKey: ['admin-teacher-documents'],
    queryFn: () => api<Application[]>('/admin/teacher-applications'),
  });
  const items = (query.data ?? []).flatMap((teacher) =>
    teacher.verificationItems.map((item) => ({ teacher, item })),
  );
  const t = (fa: string, en: string) => localized({ fa, en }, locale);

  return (
    <section>
      <h1 className="text-3xl font-black">{t('بررسی مدارک مدرس‌ها', 'Teacher document review')}</h1>
      <p className="mt-2 text-sm text-muted">
        {t('فایل را پیش از ثبت نتیجه بازبینی کنید.', 'Open each file before recording a review outcome.')}
      </p>
      {query.isLoading ? (
        <div className="mt-6 grid gap-4"><div className="skeleton h-48 rounded-3xl" /><div className="skeleton h-48 rounded-3xl" /></div>
      ) : query.isError ? (
        <div role="alert" className="mt-6 rounded-2xl bg-red-50 p-5 text-red-800">
          {apiMessage(query.error, t('مدارک مدرس‌ها دریافت نشد.', 'Teacher documents could not be loaded.'))}{' '}
          <button type="button" onClick={() => query.refetch()} className="font-black underline">{t('تلاش دوباره', 'Try again')}</button>
        </div>
      ) : items.length ? (
        <div className="mt-6 grid gap-5">
          {items.map(({ teacher, item }) => (
            <DocumentCard key={item.id} teacher={teacher} item={item} />
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-3xl border border-dashed hairline p-10 text-center text-muted">
          {t('مدرکی برای بررسی وجود ندارد.', 'There are no documents to review.')}
        </div>
      )}
    </section>
  );
}

function DocumentCard({ teacher, item }: { teacher: Application; item: VerificationItem }) {
  const { locale } = useTranslations();
  const qc = useQueryClient();
  const t = (fa: string, en: string) => localized({ fa, en }, locale);
  const download = useQuery({
    queryKey: ['admin-teacher-document-download', item.file.id],
    queryFn: () => api<{ url: string }>(`/files/${item.file.id}/download`),
    enabled: false,
    retry: false,
  });
  const review = useMutation({
    mutationFn: (input: { status: string; note?: string }) =>
      api(`/admin/verification-items/${item.id}/review`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-teacher-documents'] }),
  });

  return (
    <article className="panel-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black">{localized({ fa: teacher.nameFa, en: teacher.nameEn }, locale)}</h2>
          <p className="mt-1 text-sm text-muted latin">{teacher.user?.phone || '—'}</p>
        </div>
        <span className="rounded-full bg-lavender px-3 py-1 text-xs font-black text-purple">{item.status}</span>
      </div>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-muted">{t('نوع مدرک', 'Document type')}</dt><dd className="mt-1 font-bold">{item.kind}</dd></div>
        <div><dt className="text-muted">{t('نام فایل', 'File name')}</dt><dd className="mt-1 break-all font-bold">{item.file.originalName}</dd></div>
        <div><dt className="text-muted">{t('نوع فایل', 'File type')}</dt><dd className="mt-1 font-bold latin">{item.file.mimeType}</dd></div>
      </dl>
      <div className="mt-5">
        {download.data ? (
          <a href={download.data.url} target="_blank" rel="noreferrer" className="secondary-button inline-flex">
            <ExternalLink size={17} /> {t('باز کردن فایل', 'Open file')}
          </a>
        ) : (
          <button type="button" onClick={() => download.refetch()} disabled={download.isFetching} className="secondary-button">
            {download.isFetching ? t('آماده‌سازی…', 'Preparing…') : t('آماده‌سازی مشاهده فایل', 'Prepare file preview')}
          </button>
        )}
        {download.isError && <p role="alert" className="mt-2 text-sm text-red-700">{t('فایل قابل دریافت نیست.', 'The file is unavailable.')}</p>}
      </div>
      <form
        className="mt-5 grid gap-3 md:grid-cols-[220px_1fr_auto] md:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          review.mutate({ status: String(form.get('status')), note: String(form.get('note') || '').trim() || undefined });
        }}
      >
        <label className="grid gap-2 text-sm font-bold">
          {t('نتیجه بررسی', 'Review outcome')}
          <select name="status" className="input">
            <option value="UNDER_REVIEW">UNDER_REVIEW</option><option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option><option value="NEEDS_REVISION">NEEDS_REVISION</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold">
          {t('یادداشت', 'Note')}
          <input name="note" defaultValue={item.note ?? ''} className="input font-normal" />
        </label>
        <button disabled={review.isPending} className="primary-button justify-center disabled:opacity-50">
          {review.isPending ? t('در حال ثبت…', 'Saving…') : t('ثبت نتیجه', 'Save outcome')}
        </button>
      </form>
      {review.isError && <p role="alert" className="mt-3 text-sm text-red-700">{apiMessage(review.error, t('نتیجه ثبت نشد.', 'The review could not be saved.'))}</p>}
    </article>
  );
}
