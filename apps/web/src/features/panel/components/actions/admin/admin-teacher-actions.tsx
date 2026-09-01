'use client';

import { translate } from '@/lib/i18n';
import { api } from '@/shared/services/api';
import {
  Area,
  Localized,
  Select,
  Shell,
  Status,
  Submit,
  TeacherApplicationSelect,
  useAction,
  value,
} from '../shared/action-controls';
export function AdminTeacherActions({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  return (
    <Shell title={translate(fa, 'legacyReviewTeacherApplication')}>
      <form
        className="mt-4 grid gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          action.mutate(() =>
            api(`/admin/teacher-applications/${value(form, 'teacherId')}/transition`, {
              method: 'POST',
              body: JSON.stringify({ status: value(form, 'status'), note: value(form, 'note') || undefined }),
            }),
          );
        }}
      >
        <TeacherApplicationSelect fa={fa} />
        <Select name="status" label={translate(fa, 'legacyNextStatus')}>
          <option>DOCUMENT_REVIEW</option>
          <option>INTERVIEW</option>
          <option>DEMO_REVIEW</option>
          <option>APPROVED</option>
          <option>REJECTED</option>
        </Select>
        <Area name="note" label={translate(fa, 'legacyReviewNote')} />
        <div className="md:col-span-2">
          <Submit fa={fa} busy={action.isPending}>
            {translate(fa, 'legacyApplyStatus')}
          </Submit>
        </div>
      </form>
      <Status fa={fa} error={action.error} ok={action.isSuccess} />
    </Shell>
  );
}
