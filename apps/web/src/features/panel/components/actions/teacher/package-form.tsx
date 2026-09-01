'use client';

import { translate } from '@/lib/i18n';
import { api } from '@/shared/services/api';
import { PACKAGE_TIERS } from '@lingospeak/contracts';
import {
  Area,
  Field,
  Localized,
  Select,
  Shell,
  Status,
  Submit,
  numeric,
  tr,
  useAction,
  value,
} from '../shared/action-controls';
export function PackageForm({ endpoint, fa }: { endpoint: string } & Localized) {
  const action = useAction(endpoint);
  return (
    <Shell title={translate(fa, 'legacyCreateTeachingPackage')}>
      <form
        className="mt-4 grid gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          // The price is derived server-side from the teacher's approved lesson rate
          // and this discount, so a package cannot sell lessons at a rate that never
          // passed price review. Only the tier and the discount are chosen here.
          action.mutate(() =>
            api('/packages', {
              method: 'POST',
              body: JSON.stringify({
                titleFa: value(form, 'titleFa'),
                titleEn: value(form, 'titleEn'),
                descriptionFa: value(form, 'descriptionFa'),
                descriptionEn: value(form, 'descriptionEn'),
                credits: numeric(form, 'credits', 5),
                lessonMinutes: numeric(form, 'lessonMinutes', 60),
                discountPercent: numeric(form, 'discountPercent', 0),
              }),
            }),
          );
        }}
      >
        <Field name="titleFa" label={translate(fa, 'legacyPersianTitle')} required />
        <Field name="titleEn" label={translate(fa, 'legacyEnglishTitle')} required dir="ltr" />
        <Select name="credits" label={translate(fa, 'legacySessionsInPackage')}>
          {PACKAGE_TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {tr(fa, `${tier} جلسه`, `${tier} session${tier === 1 ? '' : 's'}`)}
            </option>
          ))}
        </Select>
        <Field
          name="lessonMinutes"
          label={translate(fa, 'legacyMinutesPerLesson')}
          type="number"
          min={15}
          max={240}
          defaultValue={60}
        />
        <Field
          name="discountPercent"
          label={translate(fa, 'legacyPackageDiscount')}
          type="number"
          min={0}
          max={80}
          defaultValue={0}
        />
        <Area name="descriptionFa" label={translate(fa, 'legacyPersianDescription')} required />
        <Area name="descriptionEn" label={translate(fa, 'legacyEnglishDescription')} required dir="ltr" />
        <div className="md:col-span-2">
          <Submit fa={fa} busy={action.isPending}>
            {translate(fa, 'legacySubmitPackageForApproval')}
          </Submit>
        </div>
      </form>
      <Status fa={fa} error={action.error} ok={action.isSuccess} />
    </Shell>
  );
}
