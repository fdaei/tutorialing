'use client';

import { translate } from '@/lib/i18n';
import { api } from '@/shared/services/api';
import { Area, BookingSelect, Field, Localized, Select, Shell, Status, StudentSelect, Submit, useAction, value } from '../shared/action-controls';
export function ClassActions({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  return (
    <Shell title={translate(fa, 'legacyAttendanceMeetingLinkAndClassCompletion')}>
      <form
        className="mt-4 grid gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          action.mutate(() =>
            api(`/bookings/${value(form, 'bookingId')}/attendance`, {
              method: 'PUT',
              body: JSON.stringify({
                student: form.get('student') === 'on',
                teacher: form.get('teacher') === 'on',
                meetingUrl: value(form, 'meetingUrl') || undefined,
              }),
            }),
          );
        }}
      >
        <BookingSelect fa={fa} />
        <Field name="meetingUrl" label={translate(fa, 'legacyMeetingURL')} type="url" dir="ltr" />
        <label className="flex gap-2">
          <input name="student" type="checkbox" />
          {translate(fa, 'legacyStudentAttended')}
        </label>
        <label className="flex gap-2">
          <input name="teacher" type="checkbox" defaultChecked />
          {translate(fa, 'legacyTeacherAttended')}
        </label>
        <div className="md:col-span-2">
          <Submit fa={fa} busy={action.isPending}>
            {translate(fa, 'legacySaveAttendance')}
          </Submit>
        </div>
      </form>
      <form
        className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          action.mutate(() => api(`/bookings/${value(form, 'bookingId')}/complete`, { method: 'POST' }));
        }}
      >
        <BookingSelect fa={fa} />
        <div>
          <Submit fa={fa} busy={action.isPending}>
            {translate(fa, 'legacyCompleteClass')}
          </Submit>
        </div>
      </form>
      <Status fa={fa} error={action.error} ok={action.isSuccess} />
    </Shell>
  );
}
