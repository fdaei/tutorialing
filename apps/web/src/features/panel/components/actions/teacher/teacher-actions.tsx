'use client';

import { translate } from '@/lib/i18n';
import { api } from '@/shared/services/api';
import { Field, Localized, Props, Shell, Status, Submit, numeric, useAction, value } from '../shared/action-controls';
import { TicketForm } from '../shared/ticket-form';
import { ClassActions } from './class-actions';
import { PackageForm } from './package-form';
import { PlanForm } from './plan-form';
import { TeacherApplicationForm } from './teacher-application-form';
import { TeacherFiles } from './teacher-files';
import { TeacherIntroVideo } from './teacher-intro-video';
export function TeacherActions({ section, endpoint, fa }: Omit<Props, 'role'> & Localized) {
  const action = useAction(endpoint);
  if (['profile', 'languages', 'specialties'].includes(section))
    return <TeacherApplicationForm endpoint={endpoint} fa={fa} />;
  if (section === 'video') return <TeacherIntroVideo endpoint={endpoint} fa={fa} />;
  if (section === 'verification') return <TeacherFiles endpoint={endpoint} fa={fa} />;

  if (section === 'availability')
    return (
      <div className="grid gap-5 xl:grid-cols-3">
        <Shell title={translate(fa, 'legacyWeeklyRule')}>
          <form
            className="mt-4 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              action.mutate(() =>
                api('/availability/me/rules', {
                  method: 'PUT',
                  body: JSON.stringify({
                    rules: [
                      {
                        weekday: numeric(form, 'weekday'),
                        startMinute: numeric(form, 'startMinute', 540),
                        endMinute: numeric(form, 'endMinute', 1020),
                        timezone: value(form, 'timezone') || 'Asia/Tehran',
                      },
                    ],
                  }),
                }),
              );
            }}
          >
            <Field
              name="weekday"
              label={translate(fa, 'legacyWeekday06')}
              type="number"
              min={0}
              max={6}
              defaultValue={6}
            />
            <Field
              name="startMinute"
              label={translate(fa, 'legacyStartMinuteOfDay')}
              type="number"
              min={0}
              max={1440}
              defaultValue={540}
            />
            <Field
              name="endMinute"
              label={translate(fa, 'legacyEndMinuteOfDay')}
              type="number"
              min={0}
              max={1440}
              defaultValue={1020}
            />
            <Field name="timezone" label={translate(fa, 'legacytimezone2')} defaultValue="Asia/Tehran" dir="ltr" />
            <Submit fa={fa} busy={action.isPending}>
              {translate(fa, 'legacySaveRule')}
            </Submit>
          </form>
          <Status fa={fa} error={action.error} ok={action.isSuccess} />
        </Shell>
        <Shell title={translate(fa, 'legacyDateOverride')}>
          <form
            className="mt-4 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              action.mutate(() =>
                api('/availability/me/overrides', {
                  method: 'POST',
                  body: JSON.stringify({
                    date: value(form, 'date'),
                    available: form.get('available') === 'on',
                    startMinute: numeric(form, 'startMinute'),
                    endMinute: numeric(form, 'endMinute'),
                    reason: value(form, 'reason') || undefined,
                  }),
                }),
              );
            }}
          >
            <Field name="date" label={translate(fa, 'legacyDate')} type="date" required />
            <label className="flex gap-2 text-sm font-bold">
              <input name="available" type="checkbox" defaultChecked />
              {translate(fa, 'legacyAvailable')}
            </label>
            <Field
              name="startMinute"
              label={translate(fa, 'legacyStartMinute')}
              type="number"
              min={0}
              max={1440}
              defaultValue={540}
            />
            <Field
              name="endMinute"
              label={translate(fa, 'legacyEndMinute')}
              type="number"
              min={0}
              max={1440}
              defaultValue={1020}
            />
            <Field name="reason" label={translate(fa, 'legacyReason')} />
            <Submit fa={fa} busy={action.isPending}>
              {translate(fa, 'legacySaveOverride')}
            </Submit>
          </form>
        </Shell>
        <Shell title={translate(fa, 'legacyBlockTimeRange')}>
          <form
            className="mt-4 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              action.mutate(() =>
                api('/availability/me/blocks', {
                  method: 'POST',
                  body: JSON.stringify({
                    startsAt: new Date(value(form, 'startsAt')).toISOString(),
                    endsAt: new Date(value(form, 'endsAt')).toISOString(),
                    reason: value(form, 'reason') || undefined,
                  }),
                }),
              );
            }}
          >
            <Field name="startsAt" label={translate(fa, 'legacyStartsAt')} type="datetime-local" required />
            <Field name="endsAt" label={translate(fa, 'legacyEndsAt')} type="datetime-local" required />
            <Field name="reason" label={translate(fa, 'legacyreason2')} />
            <Submit fa={fa} busy={action.isPending}>
              {translate(fa, 'legacyBlockPeriod')}
            </Submit>
          </form>
          <Status fa={fa} error={action.error} ok={action.isSuccess} />
        </Shell>
      </div>
    );
  if (section === 'packages') return <PackageForm endpoint={endpoint} fa={fa} />;
  if (section === 'plans') return <PlanForm endpoint={endpoint} fa={fa} />;
  if (section === 'classes') return <ClassActions endpoint={endpoint} fa={fa} />;
  if (section === 'tickets') return <TicketForm endpoint={endpoint} fa={fa} />;
  return null;
}
