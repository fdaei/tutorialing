'use client';

import { translate } from '@/lib/i18n';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/services/api';
import { BookingSelect, Field, Localized, Shell, Status, Submit, useAction, value } from '../shared/action-controls';
export function ClassActions({ endpoint, fa }: { endpoint: string } & Localized) {
  const attendanceAction = useAction(endpoint);
  const completionAction = useAction(endpoint);
  const meetingAction = useAction(endpoint);
  const profile = useQuery({
    queryKey: ['teacher-application'],
    queryFn: () => api<{ meetingUrl?: string | null } | null>('/teacher/application'),
  });
  return (
    <Shell title={translate(fa, 'legacyAttendanceMeetingLinkAndClassCompletion')}>
      <form
        key={profile.data?.meetingUrl ?? ''}
        className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          meetingAction.mutate(() =>
            api('/teacher/profile/meeting-url', {
              method: 'PUT',
              body: JSON.stringify({ meetingUrl: value(form, 'standingMeetingUrl') || null }),
            }),
          );
        }}
      >
        <Field
          name="standingMeetingUrl"
          label={fa ? 'لینک ثابت Google Meet (برای همه کلاس‌ها)' : 'Standing Google Meet link (all classes)'}
          type="url"
          dir="ltr"
          placeholder="https://meet.google.com/abc-defg-hij"
          defaultValue={profile.data?.meetingUrl ?? ''}
        />
        <div>
          <Submit fa={fa} busy={meetingAction.isPending}>
            {fa ? 'ذخیره لینک' : 'Save link'}
          </Submit>
        </div>
      </form>
      <Status fa={fa} error={meetingAction.error} ok={meetingAction.isSuccess} />
      <form
        className="mt-4 grid gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          attendanceAction.mutate(() =>
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
          <Submit fa={fa} busy={attendanceAction.isPending}>
            {translate(fa, 'legacySaveAttendance')}
          </Submit>
        </div>
      </form>
      <Status fa={fa} error={attendanceAction.error} ok={attendanceAction.isSuccess} />
      <form
        className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          completionAction.mutate(() => api(`/bookings/${value(form, 'bookingId')}/complete`, { method: 'POST' }));
        }}
      >
        <BookingSelect fa={fa} />
        <div>
          <Submit fa={fa} busy={completionAction.isPending}>
            {translate(fa, 'legacyCompleteClass')}
          </Submit>
        </div>
      </form>
      <Status fa={fa} error={completionAction.error} ok={completionAction.isSuccess} />
    </Shell>
  );
}
