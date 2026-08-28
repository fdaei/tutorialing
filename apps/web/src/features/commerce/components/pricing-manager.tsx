'use client';

import { localized, isDefaultLocale, translate } from '@/lib/i18n';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiMessage, type Paginated } from '@/lib/api';
import { useTranslations } from '@/components/shared/locale-provider';

type TeacherPrice = {
  id: string;
  nameFa: string;
  nameEn: string;
  priceStatus: string;
  proposedTrialPrice?: number;
  proposedRegularPrice?: number;
  approvedTrialPrice?: number;
  approvedRegularPrice?: number;
  counterTrialPrice?: number;
  counterRegularPrice?: number;
  priceReviewNote?: string;
  user: { phone: string; email?: string };
  priceHistory: { id: string; action: string; status: string; note?: string; createdAt: string }[];
};
export function PricingManager({ mode }: { mode: 'teacher' | 'admin' }) {
  const { locale } = useTranslations(),
    fa = isDefaultLocale(locale);
  return mode === 'teacher' ? <TeacherPricing fa={fa} /> : <AdminPricing fa={fa} />;
}
function TeacherPricing({ fa }: { fa: boolean }) {
  const { locale } = useTranslations();
  const qc = useQueryClient(),
    query = useQuery({ queryKey: ['teacher-pricing'], queryFn: () => api<TeacherPrice>('/teacher/pricing') }),
    [trial, setTrial] = useState(250000),
    [regular, setRegular] = useState(500000);
  const propose = useMutation({
    mutationFn: () =>
      api('/teacher/pricing/propose', {
        method: 'POST',
        body: JSON.stringify({ proposedTrialPrice: trial, proposedRegularPrice: regular }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teacher-pricing'] }),
  });
  const accept = useMutation({
    mutationFn: () => api('/teacher/pricing/accept-counter', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teacher-pricing'] }),
  });
  const data = query.data;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-3xl border hairline bg-white p-6">
        <h2 className="text-2xl font-black">{translate(fa, 'commercepricingManagerPriceProposal')}</h2>
        <p className="mt-2 text-sm text-muted">
          {translate(fa, 'commercepricingManagerPublicPricesAreShownOnlyAfterFinalManagement')}
        </p>
        <div className="mt-6 grid gap-4">
          <Money label={translate(fa, 'commercepricingManagerProposedTrialPrice')} value={trial} onChange={setTrial} />
          <Money
            label={translate(fa, 'commercepricingManagerProposedRegularPrice')}
            value={regular}
            onChange={setRegular}
          />
          {propose.isError && <ErrorText error={propose.error} fa={fa} />}
          <button
            onClick={() => propose.mutate()}
            disabled={propose.isPending}
            className="brand-gradient rounded-xl py-3 font-black text-white"
          >
            {translate(fa, 'commercepricingManagerSubmitForReview')}
          </button>
        </div>
        {data?.priceStatus === 'COUNTER_OFFER' && (
          <div className="mt-6 rounded-2xl bg-amber-50 p-5">
            <strong>{translate(fa, 'commercepricingManagerManagementCounterOffer')}</strong>
            <p className="mt-2">
              {money(data.counterTrialPrice, fa)} · {money(data.counterRegularPrice, fa)}
            </p>
            <button onClick={() => accept.mutate()} className="mt-4 rounded-xl bg-navy px-5 py-3 font-bold text-white">
              {translate(fa, 'commercepricingManagerAcceptCounterOffer')}
            </button>
          </div>
        )}
      </section>
      <section className="rounded-3xl border hairline bg-white p-6">
        <h2 className="text-2xl font-black">{translate(fa, 'commercepricingManagerStatusAndHistory')}</h2>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <Meta label={translate(fa, 'commercepricingManagerStatus')} value={data?.priceStatus ?? '—'} />
          <Meta
            label={translate(fa, 'commercepricingManagerApprovedTrial')}
            value={money(data?.approvedTrialPrice, fa)}
          />
          <Meta
            label={translate(fa, 'commercepricingManagerApprovedRegular')}
            value={money(data?.approvedRegularPrice, fa)}
          />
          <Meta label={translate(fa, 'commercepricingManagerReviewNote')} value={data?.priceReviewNote ?? '—'} />
        </dl>
        <div className="mt-6 grid gap-3">
          {data?.priceHistory?.map((item) => (
            <div key={item.id} className="rounded-xl bg-[#f7f8fc] p-4">
              <strong>
                {item.action} · {item.status}
              </strong>
              <p className="mt-1 text-sm text-muted">
                {item.note || '—'} ·{' '}
                {new Intl.DateTimeFormat(translate(locale, 'commercepricingManagerEnUS'), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(item.createdAt))}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
function AdminPricing({ fa }: { fa: boolean }) {
  const { locale } = useTranslations();
  const qc = useQueryClient(),
    [status, setStatus] = useState(''),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<TeacherPrice | null>(null),
    [action, setAction] = useState<'start_review' | 'counter' | 'reject' | 'recommend_approval' | 'approve'>(
      'start_review',
    ),
    [counterTrial, setCounterTrial] = useState(250000),
    [counterRegular, setCounterRegular] = useState(500000),
    [note, setNote] = useState('');
  const query = useQuery({
    queryKey: ['admin-prices', status, search, page],
    queryFn: () =>
      api<Paginated<TeacherPrice>>(
        `/admin/teacher-prices?page=${page}&limit=20&status=${status}&search=${encodeURIComponent(search)}`,
      ),
  });
  const review = useMutation({
    mutationFn: () =>
      api(`/admin/teacher-prices/${selected?.id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          counterTrialPrice: action === 'counter' ? counterTrial : undefined,
          counterRegularPrice: action === 'counter' ? counterRegular : undefined,
          note: note || undefined,
        }),
      }),
    onSuccess: () => {
      setSelected(null);
      qc.invalidateQueries({ queryKey: ['admin-prices'] });
    },
  });
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-3xl border hairline bg-white p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
            placeholder={translate(fa, 'commercepricingManagerNamePhoneOrEmail')}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            <option value="">{translate(fa, 'commercepricingManagerAllStatuses')}</option>
            {['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'COUNTER_OFFER', 'APPROVED', 'REJECTED'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        <div className="mt-5 grid gap-3">
          {query.data?.data.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelected(item)}
              className={`rounded-2xl border p-5 text-start ${selected?.id === item.id ? 'border-purple bg-lavender/30' : 'hairline'}`}
            >
              <div className="flex justify-between gap-3">
                <strong>{localized({ fa: item.nameFa, en: item.nameEn }, locale)}</strong>
                <span className="text-xs font-black text-purple">{item.priceStatus}</span>
              </div>
              <p className="mt-2 text-sm text-muted">
                {item.user.phone} · {money(item.proposedTrialPrice, fa)} / {money(item.proposedRegularPrice, fa)}
              </p>
            </button>
          ))}
        </div>
      </section>
      <section className="rounded-3xl border hairline bg-white p-6">
        {selected ? (
          <>
            <h2 className="text-2xl font-black">{localized({ fa: selected.nameFa, en: selected.nameEn }, fa)}</h2>
            <p className="mt-2 text-muted">
              {translate(fa, 'commercepricingManagerTeacherProposal')}: {money(selected.proposedTrialPrice, fa)} /{' '}
              {money(selected.proposedRegularPrice, fa)}
            </p>
            <div className="mt-5 grid gap-4">
              <select value={action} onChange={(e) => setAction(e.target.value as typeof action)} className="input">
                <option value="start_review">{translate(fa, 'commercepricingManagerStartReview')}</option>
                <option value="counter">{translate(fa, 'commercepricingManagerCounterOffer')}</option>
                <option value="reject">{translate(fa, 'commercepricingManagerReject')}</option>
                <option value="recommend_approval">{translate(fa, 'commercepricingManagerRecommendApproval')}</option>
                <option value="approve">{translate(fa, 'commercepricingManagerFinalAdminApproval')}</option>
              </select>
              {action === 'counter' && (
                <>
                  <Money
                    label={translate(fa, 'commercepricingManagerCounterTrial')}
                    value={counterTrial}
                    onChange={setCounterTrial}
                  />
                  <Money
                    label={translate(fa, 'commercepricingManagerCounterRegular')}
                    value={counterRegular}
                    onChange={setCounterRegular}
                  />
                </>
              )}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="input min-h-28"
                placeholder={translate(fa, 'commercepricingManagerDetailedReviewNote')}
              />
              {review.isError && <ErrorText error={review.error} fa={fa} />}
              <button onClick={() => review.mutate()} className="brand-gradient rounded-xl py-3 font-black text-white">
                {translate(fa, 'commercepricingManagerSaveDecision')}
              </button>
            </div>
          </>
        ) : (
          <p className="text-muted">{translate(fa, 'commercepricingManagerSelectAPriceRequest')}</p>
        )}
      </section>
      <style jsx global>{`
        .input {
          width: 100%;
          border: 1px solid rgba(16, 29, 53, 0.14);
          border-radius: 0.9rem;
          padding: 0.8rem 1rem;
          background: white;
          outline: none;
        }
        .input:focus {
          border-color: #7257d9;
          box-shadow: 0 0 0 4px rgba(114, 87, 217, 0.08);
        }
      `}</style>
    </div>
  );
}
function Money({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label>
      <span className="mb-2 block text-sm font-black">{label}</span>
      <input
        type="number"
        min={10000}
        step={10000}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="input"
      />
    </label>
  );
}
function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-bold">{value}</dd>
    </div>
  );
}
function money(value: number | undefined, fa: boolean) {
  return value == null
    ? '—'
    : new Intl.NumberFormat(translate(fa, 'commercepricingManagerEnUS2')).format(value) +
        translate(fa, 'commercepricingManagerIrr');
}
function ErrorText({ error, fa }: { error: unknown; fa: boolean }) {
  return (
    <p className="rounded-xl bg-red-50 p-3 text-red-800">
      {apiMessage(error, translate(fa, 'commercepricingManagerTheOperationFailed'))}
    </p>
  );
}
