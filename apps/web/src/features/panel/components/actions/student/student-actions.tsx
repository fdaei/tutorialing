'use client';

import { translate } from '@/lib/i18n';
import { api } from '@/shared/services/api';
import { useTranslations } from '@/components/shared/locale-provider';
import {
  Area,
  AssignmentSelect,
  Field,
  Localized,
  Props,
  Select,
  Shell,
  Status,
  Submit,
  useAction,
  value,
} from '../shared/action-controls';
import { TicketForm } from '../shared/ticket-form';
export function StudentActions({ section, endpoint, fa }: Omit<Props, 'role'> & Localized) {
  const { locale } = useTranslations();
  const action = useAction(endpoint);
  if (section === 'profile')
    return (
      <Shell title={translate(fa, 'legacyCompleteProfile')}>
        <form
          className="mt-4 grid gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            action.mutate(() =>
              api('/users/me', {
                method: 'PUT',
                body: JSON.stringify({
                  name: value(form, 'name'),
                  email: value(form, 'email') || undefined,
                  locale: value(form, 'locale') || translate(locale, 'panelpanelActionsEn'),
                  timezone: value(form, 'timezone') || 'Asia/Tehran',
                }),
              }),
            );
          }}
        >
          <Field name="name" label={translate(fa, 'legacyName')} required />
          <Field name="email" label={translate(fa, 'legacyEmail')} type="email" dir="ltr" />
          <Select name="locale" label={translate(fa, 'legacyInterfaceLanguage')}>
            <option value="fa">فارسی</option>
            <option value="en">English</option>
          </Select>
          <Field name="timezone" label={translate(fa, 'legacyTimezone')} defaultValue="Asia/Tehran" dir="ltr" />
          <div className="md:col-span-2">
            <Submit fa={fa} busy={action.isPending}>
              {translate(fa, 'legacySaveProfile')}
            </Submit>
          </div>
        </form>
        <Status fa={fa} error={action.error} ok={action.isSuccess} />
      </Shell>
    );
  if (section === 'tickets') return <TicketForm endpoint={endpoint} fa={fa} />;
  if (section === 'plan')
    return (
      <Shell title={translate(fa, 'legacySubmitAssignment')}>
        <form
          className="mt-4 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            action.mutate(() =>
              api(`/learning/assignments/${value(form, 'assignmentId')}/submit`, {
                method: 'POST',
                body: JSON.stringify({ submission: value(form, 'submission') }),
              }),
            );
          }}
        >
          <AssignmentSelect fa={fa} />
          <Area name="submission" label={translate(fa, 'legacyResponse')} required />
          <Submit fa={fa} busy={action.isPending}>
            {translate(fa, 'legacySubmitResponse')}
          </Submit>
        </form>
        <Status fa={fa} error={action.error} ok={action.isSuccess} />
      </Shell>
    );
  return null;
}
