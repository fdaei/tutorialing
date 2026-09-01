'use client';

import { translate } from '@/lib/i18n';
import { api } from '@/shared/services/api';
import {
  ApprovedTeacherSelect,
  Field,
  Localized,
  Shell,
  Status,
  Submit,
  useAction,
  value,
} from '../shared/action-controls';
export function AdminBookingActions({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  return (
    <Shell title={translate(fa, 'legacyAdminCalendarBlock')}>
      <form
        className="mt-4 grid gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          action.mutate(() =>
            api('/availability/admin/blocks', {
              method: 'POST',
              body: JSON.stringify({
                teacherId: value(form, 'teacherId'),
                startsAt: new Date(value(form, 'startsAt')).toISOString(),
                endsAt: new Date(value(form, 'endsAt')).toISOString(),
                reason: value(form, 'reason') || undefined,
              }),
            }),
          );
        }}
      >
        <ApprovedTeacherSelect fa={fa} />
        <Field name="startsAt" label={translate(fa, 'legacystartsAt2')} type="datetime-local" required />
        <Field name="endsAt" label={translate(fa, 'legacyendsAt2')} type="datetime-local" required />
        <Field name="reason" label={translate(fa, 'legacyreason3')} />
        <div className="md:col-span-2">
          <Submit fa={fa} busy={action.isPending}>
            {translate(fa, 'legacyCreateBlock')}
          </Submit>
        </div>
      </form>
      <Status fa={fa} error={action.error} ok={action.isSuccess} />
    </Shell>
  );
}
