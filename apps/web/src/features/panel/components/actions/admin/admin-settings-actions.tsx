'use client';

import { translate } from '@/lib/i18n';
import { api } from '@/shared/services/api';
import { Area, Field, Localized, Shell, Status, Submit, useAction, value } from '../shared/action-controls';
export function AdminSettingsActions({
  endpoint,
  fa,
  section,
}: { endpoint: string; section: 'settings' | 'cms' } & Localized) {
  const action = useAction(endpoint);
  const cardAction = useAction(endpoint);
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {section === 'settings' && (
        <>
          <Shell title={fa ? 'کارت دریافت وجه' : 'Payment card'}>
            <form
              className="mt-4 grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                cardAction.mutate(() =>
                  api('/admin/settings/payment.card', {
                    method: 'PUT',
                    body: JSON.stringify({
                      value: {
                        cardNumber: value(form, 'cardNumber'),
                        holder: value(form, 'holder'),
                        bank: value(form, 'bank'),
                      },
                      public: true,
                    }),
                  }),
                );
              }}
            >
              <Field name="cardNumber" label={fa ? 'شماره کارت' : 'Card number'} required dir="ltr" />
              <Field name="holder" label={fa ? 'نام صاحب حساب' : 'Account holder'} required />
              <Field name="bank" label={fa ? 'نام بانک' : 'Bank'} required />
              <Submit fa={fa} busy={cardAction.isPending}>
                {fa ? 'ذخیره اطلاعات کارت' : 'Save payment card'}
              </Submit>
            </form>
            <Status fa={fa} error={cardAction.error} ok={cardAction.isSuccess} />
          </Shell>
          <Shell title={translate(fa, 'legacyGeneralSetting')}>
            <form
              className="mt-4 grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                action.mutate(() =>
                  api(`/admin/settings/${encodeURIComponent(value(form, 'key'))}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                      value: { value: value(form, 'settingValue') },
                      public: form.get('public') === 'on',
                    }),
                  }),
                );
              }}
            >
              <Field name="key" label={translate(fa, 'legacyKey')} required dir="ltr" />
              <Field name="settingValue" label={translate(fa, 'legacyValue')} required />
              <label className="flex gap-2">
                <input name="public" type="checkbox" />
                {translate(fa, 'legacyPublic')}
              </label>
              <Submit fa={fa} busy={action.isPending}>
                {translate(fa, 'legacySaveSetting')}
              </Submit>
            </form>
            <Status fa={fa} error={action.error} ok={action.isSuccess} />
          </Shell>
        </>
      )}
      {section === 'cms' && (
        <Shell title={translate(fa, 'legacyBilingualCMSPage')}>
          <form
            className="mt-4 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              action.mutate(() =>
                api(`/admin/cms/${encodeURIComponent(value(form, 'slug'))}`, {
                  method: 'PUT',
                  body: JSON.stringify({
                    titleFa: value(form, 'titleFa'),
                    titleEn: value(form, 'titleEn'),
                    contentFa: { paragraphs: [value(form, 'bodyFa')] },
                    contentEn: { paragraphs: [value(form, 'bodyEn')] },
                    published: true,
                  }),
                }),
              );
            }}
          >
            <Field name="slug" label="Slug" required dir="ltr" />
            <Field name="titleFa" label={translate(fa, 'legacypersianTitle2')} required />
            <Field name="titleEn" label={translate(fa, 'legacyenglishTitle2')} required dir="ltr" />
            <Area name="bodyFa" label={translate(fa, 'legacyPersianContent')} required />
            <Area name="bodyEn" label={translate(fa, 'legacyEnglishContent')} required dir="ltr" />
            <Submit fa={fa} busy={action.isPending}>
              {translate(fa, 'legacySavePage')}
            </Submit>
          </form>
          <Status fa={fa} error={action.error} ok={action.isSuccess} />
        </Shell>
      )}
    </div>
  );
}
