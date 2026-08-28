'use client';

import { translate } from '@/lib/i18n';
import { api } from '@/shared/services/api';
import { Area, Field, Localized, Select, Shell, Status, Submit, useAction, value } from '../shared/action-controls';
export function TicketForm({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  return (
    <Shell title={translate(fa, 'legacySupportTicket')}>
      <form
        className="mt-4 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          action.mutate(() =>
            api('/support/tickets', {
              method: 'POST',
              body: JSON.stringify({
                subject: value(form, 'subject'),
                category: value(form, 'category') || 'general',
                priority: value(form, 'priority') || 'normal',
                body: value(form, 'body'),
              }),
            }),
          );
        }}
      >
        <Field name="subject" label={translate(fa, 'legacySubject')} required />
        <Field name="category" label={translate(fa, 'legacyCategory')} defaultValue="general" dir="ltr" />
        <Select name="priority" label={translate(fa, 'legacyPriority')}>
          <option value="normal">{translate(fa, 'legacyNormal')}</option>
          <option value="high">{translate(fa, 'legacyHigh')}</option>
          <option value="urgent">{translate(fa, 'legacyUrgent')}</option>
        </Select>
        <Area name="body" label={translate(fa, 'legacyMessage')} required />
        <Submit fa={fa} busy={action.isPending}>
          {translate(fa, 'legacyCreateTicket')}
        </Submit>
      </form>
      <Status fa={fa} error={action.error} ok={action.isSuccess} />
    </Shell>
  );
}
