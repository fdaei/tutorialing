'use client';

import { localized, translate } from '@/lib/i18n';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/services/api';
import { uploadPanelFile } from '../../../services/upload-panel-file';
import { uploadErrorMessage } from '@/shared/services/upload';
import { Field, Localized, Select, Shell, Status, Submit, useAction, value } from '../shared/action-controls';
export function TeacherFiles({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  const application = useQuery({
    queryKey: [endpoint],
    queryFn: () =>
      api<{
        introVideoKey?: string;
        verificationItems?: { id: string; kind: string; status: string; rejectionReason?: string; note?: string }[];
      }>(endpoint),
  });
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState('');
  const uploadedKinds = new Set(
    (application.data?.verificationItems ?? [])
      .filter((item) => ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(item.status))
      .map((item) => item.kind.toLowerCase()),
  );
  const documentsReady = uploadedKinds.has('identity') && uploadedKinds.has('certificate');
  const applicationReady = documentsReady && Boolean(application.data?.introVideoKey);
  return (
    <Shell title={translate(fa, 'legacyDocumentsAndIntroductionVideo')}>
      <form
        className="mt-4 grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setFileError('');
          const formElement = event.currentTarget;
          const form = new FormData(formElement);
          try {
            const file = form.get('file');
            if (!(file instanceof File) || !file.size) throw new Error(translate(fa, 'legacySelectAFileFirst'));
            const kind = value(form, 'kind');
            const fileId = await uploadPanelFile(
              file,
              kind === 'intro-video' ? 'teacher-intro-video' : 'teacher-verification',
              fa,
            );
            await action.mutateAsync(() =>
              kind === 'intro-video'
                ? api('/teacher/profile/intro-video', { method: 'PUT', body: JSON.stringify({ fileId }) })
                : api('/teacher/application/documents', { method: 'POST', body: JSON.stringify({ kind, fileId }) }),
            );
            formElement.reset();
          } catch (error) {
            setFileError(uploadErrorMessage(error, translate(fa, 'legacyUploadFailedCheckTheConnectionAndFileType')));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Select name="kind" label={translate(fa, 'legacyDocumentType')}>
          <option value="identity">{translate(fa, 'legacyIdentity')}</option>
          <option value="certificate">{translate(fa, 'legacyCertificate')}</option>
          <option value="experience">{translate(fa, 'legacyExperience')}</option>
          <option value="demo-lesson">{translate(fa, 'legacyTeachingDemo')}</option>
          <option value="intro-video">{translate(fa, 'legacyintroductionVideo2')}</option>
        </Select>
        <label className="block">
          <span className="mb-2 block text-sm font-bold">{translate(fa, 'legacyFileMaximum50MB')}</span>
          <input
            name="file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.mp4,.webm,.mov"
            className="w-full rounded-2xl border hairline p-3"
            required
          />
        </label>
        <Submit fa={fa} busy={busy || action.isPending}>
          {translate(fa, 'legacyUploadAndAttach')}
        </Submit>
      </form>
      <p
        className={`mt-5 rounded-xl p-3 text-sm ${applicationReady ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}
      >
        {applicationReady
          ? translate(fa, 'legacyBothRequiredDocumentsAreUploadedSubmitYourApplication')
          : fa
            ? 'برای ارسال درخواست، مدرک هویتی، مدرک آموزشی و ویدیوی معرفی را بارگذاری کنید.'
            : 'Upload an identity document, teaching certificate, and introduction video before submitting.'}
      </p>
      <div className="mt-3 grid gap-2">
        {(application.data?.verificationItems ?? []).map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-xl border hairline p-3 text-sm">
            <span>{documentKind(item.kind, fa)}</span>
            <span className="font-bold">{documentStatus(item.status, fa)}</span>
          </div>
        ))}
      </div>
      {(application.data?.verificationItems ?? [])
        .filter((item) => ['REJECTED', 'NEEDS_REVISION'].includes(item.status))
        .map((item) => (
          <form
            key={item.id}
            className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const element = event.currentTarget,
                form = new FormData(element),
                file = form.get('file');
              if (!(file instanceof File) || !file.size) return;
              setBusy(true);
              setFileError('');
              try {
                const fileId = await uploadPanelFile(file, 'teacher-verification', fa);
                await action.mutateAsync(() =>
                  api(`/teacher/application/documents/${item.id}/resubmit`, {
                    method: 'POST',
                    body: JSON.stringify({ fileId }),
                  }),
                );
                element.reset();
              } catch (error) {
                setFileError(uploadErrorMessage(error, translate(fa, 'legacyDocumentResubmissionFailed')));
              } finally {
                setBusy(false);
              }
            }}
          >
            <strong>
              {translate(fa, 'legacyNeedsRevision')}
              {item.kind}
            </strong>
            <p className="my-2 text-sm text-amber-900">
              {item.rejectionReason || item.note || translate(fa, 'legacyUploadACorrectedVersion')}
            </p>
            <input
              name="file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              required
              className="w-full rounded-xl border bg-white p-2"
            />
            <Submit fa={fa} busy={busy || action.isPending}>
              {translate(fa, 'legacyUploadCorrectedFileAndResubmit')}
            </Submit>
          </form>
        ))}
      <form
        className="mt-2"
        onSubmit={(event) => {
          event.preventDefault();
          action.mutate(() => api('/teacher/application/submit', { method: 'POST' }));
        }}
      >
        <Submit fa={fa} busy={action.isPending || application.isLoading || !applicationReady}>
          {translate(fa, 'legacySubmitForReview')}
        </Submit>
      </form>
      {fileError && (
        <p role="alert" className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-800">
          {fileError}
        </p>
      )}
      <Status fa={fa} error={action.error} ok={action.isSuccess} />
    </Shell>
  );
}

function documentKind(kind: string, fa: boolean) {
  const map: Record<string, [string, string]> = {
    identity: ['مدرک هویتی', 'Identity'],
    certificate: ['مدرک آموزشی', 'Teaching certificate'],
    experience: ['سابقه کاری', 'Experience'],
    ['demo-lesson']: ['دموی تدریس', 'Teaching demo'],
  };
  return (map[kind] ?? [kind, kind])[localized({ fa: 0, en: 1 }, fa)];
}
function documentStatus(status: string, fa: boolean) {
  const map: Record<string, [string, string]> = {
    SUBMITTED: ['ارسال‌شده', 'Submitted'],
    UNDER_REVIEW: ['در حال بررسی', 'Under review'],
    APPROVED: ['تأییدشده', 'Approved'],
    REJECTED: ['ردشده', 'Rejected'],
    NEEDS_REVISION: ['نیازمند اصلاح', 'Needs revision'],
  };
  return (map[status] ?? [status, status])[localized({ fa: 0, en: 1 }, fa)];
}
