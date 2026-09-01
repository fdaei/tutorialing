'use client';

import { localized, isDefaultLocale, translate } from '@/lib/i18n';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { api, apiMessage, type Paginated } from '@/shared/services/api';
import type { EducationalLanguage } from '@/features/languages';
import { useTranslations } from '@/components/shared/locale-provider';
import { adminDeleteConfirmation } from '../admin-confirmation';

const emptyLanguageForm = {
  code: '',
  nameFa: '',
  nameEn: '',
  nativeName: '',
  flag: '🌐',
  direction: 'LTR',
  proficiencySystem: 'CEFR',
  active: true,
  order: 0,
};

export function LanguageManager() {
  const { locale } = useTranslations(),
    fa = isDefaultLocale(locale),
    qc = useQueryClient(),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [editing, setEditing] = useState<EducationalLanguage | null>(null),
    [form, setForm] = useState(emptyLanguageForm);
  const query = useQuery({
    queryKey: ['admin-languages', search, page],
    queryFn: () =>
      api<Paginated<EducationalLanguage>>(
        `/admin/languages?page=${page}&limit=20&search=${encodeURIComponent(search)}`,
      ),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-languages'] });
  const save = useMutation({
    mutationFn: () =>
      api(editing ? `/admin/languages/${editing.id}` : '/admin/languages', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      setEditing(null);
      setForm(emptyLanguageForm);
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/languages/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });
  function edit(item: EducationalLanguage) {
    setEditing(item);
    setForm({
      code: item.code,
      nameFa: item.nameFa,
      nameEn: item.nameEn,
      nativeName: item.nativeName,
      flag: item.flag || '',
      direction: item.direction,
      proficiencySystem: item.proficiencySystem,
      active: item.active,
      order: item.order,
    });
  }
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
      <section className="rounded-3xl border hairline bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">{translate(locale, 'adminlanguageManagerEducationalLanguages')}</h2>
            <p className="mt-2 text-sm text-muted">
              {translate(locale, 'adminlanguageManagerAllEducationalLanguageSelectorsUseThisDatabaseList')}
            </p>
          </div>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="input max-w-xs"
            placeholder={translate(locale, 'adminlanguageManagerSearchLanguages')}
          />
        </div>
        {query.isLoading ? (
          <div className="mt-6 skeleton h-80 rounded-2xl" />
        ) : query.isError ? (
          <Error
            message={apiMessage(query.error, translate(locale, 'adminlanguageManagerCouldNotLoadLanguages'))}
            retry={() => query.refetch()}
          />
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b hairline text-start text-muted">
                  <th className="p-3 text-start">{translate(locale, 'adminlanguageManagerLanguage')}</th>
                  <th className="p-3 text-start">Code</th>
                  <th className="p-3 text-start">{translate(locale, 'adminlanguageManagerDirection')}</th>
                  <th className="p-3 text-start">{translate(locale, 'adminlanguageManagerProficiency')}</th>
                  <th className="p-3 text-start">{translate(locale, 'commercepricingManagerStatus')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {query.data?.data.map((item) => (
                  <tr key={item.id} className="border-b hairline">
                    <td className="p-3">
                      <strong>
                        {item.flag} {localized({ fa: item.nameFa, en: item.nameEn }, locale)}
                      </strong>
                      <small className="mt-1 block text-muted">{item.nativeName}</small>
                    </td>
                    <td className="p-3 latin">{item.code}</td>
                    <td className="p-3">{item.direction}</td>
                    <td className="p-3">{item.proficiencySystem}</td>
                    <td className="p-3">
                      {item.active
                        ? translate(locale, 'admincountryManagerActive')
                        : translate(locale, 'admincountryManagerInactive')}
                    </td>
                    <td className="p-3">
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
                          aria-label={localized(
                            { fa: `حذف ${item.nameFa}`, en: `Delete ${item.nameEn}` },
                            locale,
                          )}
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {remove.isError && (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-red-800">
            {apiMessage(remove.error, localized({ fa: 'حذف زبان انجام نشد.', en: 'The language could not be deleted.' }, locale))}
          </p>
        )}
        <div className="mt-5 flex justify-between">
          <button
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
            className="rounded-xl border hairline px-4 py-2 disabled:opacity-30"
          >
            {translate(locale, 'admincountryManagerPrevious')}
          </button>
          <span>
            {page} / {Math.max(1, query.data?.totalPages ?? 1)}
          </span>
          <button
            disabled={page >= (query.data?.totalPages ?? 1)}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-xl border hairline px-4 py-2 disabled:opacity-30"
          >
            {translate(locale, 'admincountryManagerNext')}
          </button>
        </div>
      </section>
      <section className="rounded-3xl border hairline bg-white p-6">
        <h2 className="text-2xl font-black">
          {editing
            ? translate(locale, 'adminlanguageManagerEditLanguage')
            : translate(locale, 'adminlanguageManagerAddLanguage')}
        </h2>
        <form
          className="mt-5 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <Field label="Code">
            <input
              value={form.code}
              onChange={(event) =>
                setForm((current) => ({ ...current, code: event.target.value.toLowerCase().replace(/[^a-z-]/g, '') }))
              }
              className="input"
              dir="ltr"
              required
              minLength={2}
              maxLength={20}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={translate(locale, 'admincountryManagerPersianName')}>
              <input
                value={form.nameFa}
                onChange={(event) => setForm((current) => ({ ...current, nameFa: event.target.value }))}
                className="input"
                required
                minLength={2}
                maxLength={100}
              />
            </Field>
            <Field label={translate(locale, 'admincountryManagerEnglishName')}>
              <input
                value={form.nameEn}
                onChange={(event) => setForm((current) => ({ ...current, nameEn: event.target.value }))}
                className="input"
                dir="ltr"
                required
                minLength={2}
                maxLength={100}
              />
            </Field>
          </div>
          <div className="grid grid-cols-[1fr_90px] gap-3">
            <Field label={translate(locale, 'adminlanguageManagerNativeName')}>
              <input
                value={form.nativeName}
                onChange={(event) => setForm((current) => ({ ...current, nativeName: event.target.value }))}
                className="input"
                required
                maxLength={100}
              />
            </Field>
            <Field label={translate(locale, 'admincountryManagerFlag')}>
              <input
                value={form.flag}
                onChange={(event) => setForm((current) => ({ ...current, flag: event.target.value }))}
                className="input text-center"
                maxLength={32}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={translate(locale, 'adminlanguageManagerDirection')}>
              <select
                value={form.direction}
                onChange={(event) => setForm((current) => ({ ...current, direction: event.target.value }))}
                className="input"
              >
                <option>LTR</option>
                <option>RTL</option>
              </select>
            </Field>
            <Field label={translate(locale, 'adminlanguageManagerProficiency2')}>
              <select
                value={form.proficiencySystem}
                onChange={(event) => setForm((current) => ({ ...current, proficiencySystem: event.target.value }))}
                className="input"
              >
                <option>CEFR</option>
                <option>CUSTOM</option>
              </select>
            </Field>
          </div>
          <Field label={translate(locale, 'admincountryManagerOrder')}>
            <input
              type="number"
              min={0}
              max={10000}
              value={form.order}
              onChange={(event) => setForm((current) => ({ ...current, order: Number(event.target.value) }))}
              className="input"
            />
          </Field>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
              className="size-5 accent-purple"
            />
            {translate(locale, 'admincountryManagerActiveAndSelectable')}
          </label>
          {save.isError && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">
              {apiMessage(save.error, translate(locale, 'adminlanguageManagerCouldNotSaveTheLanguage'))}
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
                  setForm(emptyLanguageForm);
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
function Error({ message, retry }: { message: string; retry: () => void }) {
  const { locale } = useTranslations();
  return (
    <div role="alert" className="mt-5 rounded-2xl bg-red-50 p-5 text-red-800">
      {message}{' '}
      <button type="button" onClick={retry} className="font-bold underline">
        {translate(locale, 'testsaudioRecorderTryAgain')}
      </button>
    </div>
  );
}
