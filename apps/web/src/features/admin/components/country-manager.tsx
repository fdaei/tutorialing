'use client';

import { localized, isDefaultLocale, translate } from '@/lib/i18n';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { api, apiMessage, type Paginated } from '@/shared/services/api';
import type { Country } from '@/features/languages';
import { useTranslations } from '@/components/shared/locale-provider';
import { adminDeleteConfirmation } from '../admin-confirmation';
import { DataTable, type Column } from '@/shared/components/ui';

const emptyForm = {
  code: '',
  nameFa: '',
  nameEn: '',
  dialCode: '+',
  flag: '🌐',
  minLength: 4,
  maxLength: 15,
  active: true,
  order: 100,
};

export function CountryManager() {
  const { locale } = useTranslations();
  const fa = isDefaultLocale(locale);
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Country | null>(null);
  const [form, setForm] = useState(emptyForm);
  const query = useQuery({
    queryKey: ['admin-countries', search, page],
    queryFn: () =>
      api<Paginated<Country>>(`/admin/countries?page=${page}&limit=30&search=${encodeURIComponent(search)}`),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-countries'] });
  const save = useMutation({
    mutationFn: () =>
      api(editing ? `/admin/countries/${editing.id}` : '/admin/countries', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      setEditing(null);
      setForm(emptyForm);
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/countries/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });
  const edit = (item: Country) => {
    setEditing(item);
    setForm({
      code: item.code,
      nameFa: item.nameFa,
      nameEn: item.nameEn,
      dialCode: item.dialCode,
      flag: item.flag,
      minLength: item.minLength,
      maxLength: item.maxLength,
      active: item.active,
      order: item.order,
    });
  };
  const columns: Column<Country>[] = [
    {
      key: 'name',
      header: translate(locale, 'admincountryManagerCountry'),
      primary: true,
      cell: (item) => (
        <>
          {item.flag} {localized({ fa: item.nameFa, en: item.nameEn }, locale)}
        </>
      ),
    },
    { key: 'code', header: 'ISO', cell: (item) => <span className="latin">{item.code}</span> },
    {
      key: 'dialCode',
      header: translate(locale, 'admincountryManagerDialCode'),
      cell: (item) => <span className="latin">{item.dialCode}</span>,
    },
    {
      key: 'length',
      header: translate(locale, 'admincountryManagerLength'),
      hideOnMobile: true,
      cell: (item) => (
        <span className="latin">
          {item.minLength}–{item.maxLength}
        </span>
      ),
    },
    {
      key: 'status',
      header: translate(locale, 'commercepricingManagerStatus'),
      cell: (item) =>
        item.active
          ? translate(locale, 'admincountryManagerActive')
          : translate(locale, 'admincountryManagerInactive'),
    },
    {
      key: 'actions',
      header: '',
      align: 'end',
      cell: (item) => (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => edit(item)}
            className="rounded-lg border hairline px-3 py-2 font-bold text-blue"
          >
            {translate(locale, 'admincountryManagerEdit')}
          </button>
          <button
            type="button"
            aria-label={translate(locale, 'admincountryManagerDeleteCountry')}
            disabled={remove.isPending}
            onClick={() =>
              window.confirm(
                adminDeleteConfirmation(localized({ fa: item.nameFa, en: item.nameEn }, locale), locale),
              ) && remove.mutate(item.id)
            }
            className="grid size-9 place-items-center rounded-lg text-red-600 hover:bg-red-50"
          >
            <Trash2 size={17} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <section className="rounded-3xl border hairline bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">{translate(locale, 'admincountryManagerCountriesAndCallingCodes')}</h2>
            <p className="mt-2 text-sm text-muted">
              {translate(locale, 'admincountryManagerTheOTPCountrySelectorUsesThisDatabaseList')}
            </p>
          </div>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input max-w-xs"
            placeholder={translate(locale, 'admincountryManagerSearchCountries')}
          />
        </div>
        {query.isError ? (
          <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-red-800">
            {apiMessage(query.error, translate(locale, 'admincountryManagerCouldNotLoadCountries'))}
          </p>
        ) : (
          <DataTable
            className="mt-6"
            columns={columns}
            rows={query.data?.data}
            rowKey={(item) => item.id}
            loading={query.isLoading}
          />
        )}
        {remove.isError && (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-red-800">
            {apiMessage(remove.error, localized({ fa: 'حذف کشور انجام نشد.', en: 'The country could not be deleted.' }, locale))}
          </p>
        )}
        <div className="mt-5 flex items-center justify-between">
          <button
            disabled={page <= 1}
            onClick={() => setPage((v) => v - 1)}
            className="rounded-xl border hairline px-4 py-2 disabled:opacity-30"
          >
            {translate(locale, 'admincountryManagerPrevious')}
          </button>
          <span>
            {page} / {Math.max(1, query.data?.totalPages ?? 1)}
          </span>
          <button
            disabled={page >= (query.data?.totalPages ?? 1)}
            onClick={() => setPage((v) => v + 1)}
            className="rounded-xl border hairline px-4 py-2 disabled:opacity-30"
          >
            {translate(locale, 'admincountryManagerNext')}
          </button>
        </div>
      </section>
      <section className="rounded-3xl border hairline bg-white p-6">
        <h2 className="text-2xl font-black">
          {editing
            ? translate(locale, 'admincountryManagerEditCountry')
            : translate(locale, 'admincountryManagerAddCountry')}
        </h2>
        <form
          className="mt-5 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid grid-cols-[90px_1fr] gap-3">
            <Field label="ISO">
              <input
                value={form.code}
                onChange={(e) =>
                  setForm({
                    ...form,
                    code: e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z]/g, '')
                      .slice(0, 2),
                  })
                }
                className="input latin"
                required
                pattern="[A-Z]{2}"
              />
            </Field>
            <Field label={translate(locale, 'admincountryManagerFlag')}>
              <input
                value={form.flag}
                onChange={(e) => setForm({ ...form, flag: e.target.value })}
                className="input text-center"
                required
                minLength={2}
                maxLength={8}
              />
            </Field>
          </div>
          <Field label={translate(locale, 'admincountryManagerPersianName')}>
            <input
              value={form.nameFa}
              onChange={(e) => setForm({ ...form, nameFa: e.target.value })}
              className="input"
              required
              maxLength={100}
            />
          </Field>
          <Field label={translate(locale, 'admincountryManagerEnglishName')}>
            <input
              dir="ltr"
              value={form.nameEn}
              onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
              className="input"
              required
              maxLength={100}
            />
          </Field>
          <Field label={translate(locale, 'admincountryManagerCallingCode')}>
            <input
              dir="ltr"
              value={form.dialCode}
              onChange={(e) => setForm({ ...form, dialCode: `+${e.target.value.replace(/\D/g, '').slice(0, 4)}` })}
              className="input"
              required
              pattern="\+[1-9][0-9]{0,3}"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={translate(locale, 'admincountryManagerMinLength')}>
              <input
                type="number"
                min={1}
                max={15}
                value={form.minLength}
                onChange={(e) => setForm({ ...form, minLength: Number(e.target.value) })}
                className="input"
              />
            </Field>
            <Field label={translate(locale, 'admincountryManagerMaxLength')}>
              <input
                type="number"
                min={1}
                max={15}
                value={form.maxLength}
                onChange={(e) => setForm({ ...form, maxLength: Number(e.target.value) })}
                className="input"
              />
            </Field>
          </div>
          <Field label={translate(locale, 'admincountryManagerOrder')}>
            <input
              type="number"
              min={0}
              max={10000}
              value={form.order}
              onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
              className="input"
            />
          </Field>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="size-5 accent-purple"
            />
            {translate(locale, 'admincountryManagerActiveAndSelectable')}
          </label>
          {save.isError && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">
              {apiMessage(save.error, translate(locale, 'admincountryManagerCouldNotSaveCountry'))}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={save.isPending}
              className="brand-gradient flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-black text-white"
            >
              <Plus size={18} />
              {translate(locale, 'admincountryManagerSave')}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setForm(emptyForm);
                }}
                className="rounded-xl border hairline px-4"
              >
                {translate(locale, 'admincountryManagerCancel')}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="mb-2 block text-sm font-black">{label}</span>
      {children}
    </label>
  );
}
