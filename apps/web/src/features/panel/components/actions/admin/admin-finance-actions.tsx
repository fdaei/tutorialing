'use client';

import { translate } from '@/lib/i18n';
import { api } from '@/shared/services/api';
import {
  Field,
  Localized,
  PaymentSelect,
  Select,
  Shell,
  Status,
  Submit,
  numeric,
  useAction,
  value,
} from '../shared/action-controls';
export function AdminFinanceActions({ endpoint, fa, section }: { endpoint: string; section: string } & Localized) {
  const refundAction = useAction(endpoint);
  const discountAction = useAction(endpoint);
  const payoutAction = useAction(endpoint);
  const showRefund = section === 'payments' || section === 'refunds';
  const showDiscount = section === 'payments' || section === 'discounts';
  const showPayout = section === 'payments' || section === 'payouts';
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      {showRefund && (
        <Shell title={translate(fa, 'legacyRefund')}>
          <form
            className="mt-4 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              refundAction.mutate(() =>
                api(`/payments/${value(form, 'paymentId')}/refunds`, {
                  method: 'POST',
                  body: JSON.stringify({
                    amount: numeric(form, 'amount'),
                    reason: value(form, 'reason'),
                    idempotencyKey: crypto.randomUUID(),
                  }),
                }),
              );
            }}
          >
            <PaymentSelect fa={fa} />
            <Field name="amount" label={translate(fa, 'legacyAmount')} type="number" min={1} required />
            <Field name="reason" label={translate(fa, 'legacyreason4')} required />
            <Submit fa={fa} busy={refundAction.isPending}>
              {translate(fa, 'legacyCreateRefund')}
            </Submit>
          </form>
          <Status fa={fa} error={refundAction.error} ok={refundAction.isSuccess} />
        </Shell>
      )}
      {showDiscount && (
        <Shell title={translate(fa, 'legacyDiscountCode')}>
          <form
            className="mt-4 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              discountAction.mutate(() =>
                api('/payouts/discounts', {
                  method: 'POST',
                  body: JSON.stringify({
                    code: value(form, 'code'),
                    type: value(form, 'type'),
                    value: numeric(form, 'discountValue'),
                    maxUses: numeric(form, 'maxUses') || undefined,
                  }),
                }),
              );
            }}
          >
            <Field name="code" label={translate(fa, 'legacyCode')} required dir="ltr" />
            <Select name="type" label={translate(fa, 'legacyType')}>
              <option value="percent">{translate(fa, 'legacyPercent')}</option>
              <option value="fixed">{translate(fa, 'legacyFixedAmount')}</option>
            </Select>
            <Field name="discountValue" label={translate(fa, 'legacyvalue2')} type="number" min={1} required />
            <Field name="maxUses" label={translate(fa, 'legacyMaximumUses')} type="number" min={1} />
            <Submit fa={fa} busy={discountAction.isPending}>
              {translate(fa, 'legacyCreateDiscount')}
            </Submit>
          </form>
          <Status fa={fa} error={discountAction.error} ok={discountAction.isSuccess} />
        </Shell>
      )}
      {showPayout && (
        <Shell title={translate(fa, 'legacyGenerateWeeklyPayout')}>
          <form
            className="mt-4 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              payoutAction.mutate(() =>
                api('/payouts/generate', {
                  method: 'POST',
                  body: JSON.stringify({ weekStart: value(form, 'weekStart'), weekEnd: value(form, 'weekEnd') }),
                }),
              );
            }}
          >
            <Field name="weekStart" label={translate(fa, 'legacyWeekStart')} type="date" required />
            <Field name="weekEnd" label={translate(fa, 'legacyWeekEnd')} type="date" required />
            <Submit fa={fa} busy={payoutAction.isPending}>
              {translate(fa, 'legacyGeneratePayout')}
            </Submit>
          </form>
          <Status fa={fa} error={payoutAction.error} ok={payoutAction.isSuccess} />
        </Shell>
      )}
    </div>
  );
}
