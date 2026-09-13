'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FileText, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { useTranslations } from '@/components/shared/locale-provider';
import { localePath, localized, isDefaultLocale } from '@/lib/i18n';
import { api, apiMessage } from '@/shared/services/api';

type PageContent = {
  eyebrow?: string;
  intro?: string;
  paragraphs?: string[];
};

type CmsPage = {
  id: string;
  slug: string;
  titleFa: string;
  titleEn: string;
  contentFa: PageContent;
  contentEn: PageContent;
  seo: { description?: string; descriptionEn?: string };
  published: boolean;
  updatedAt: string;
};

type CmsForm = {
  titleFa: string;
  titleEn: string;
  eyebrowFa: string;
  eyebrowEn: string;
  introFa: string;
  introEn: string;
  paragraphsFa: string[];
  paragraphsEn: string[];
  seoDescriptionFa: string;
  seoDescriptionEn: string;
  published: boolean;
};

const emptyParagraphs = () => [''];

function contentOf(value: unknown): PageContent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  return {
    eyebrow: typeof raw.eyebrow === 'string' ? raw.eyebrow : '',
    intro: typeof raw.intro === 'string' ? raw.intro : '',
    paragraphs: Array.isArray(raw.paragraphs)
      ? raw.paragraphs.filter((item): item is string => typeof item === 'string')
      : [],
  };
}

function formOf(page: CmsPage): CmsForm {
  const fa = contentOf(page.contentFa);
  const en = contentOf(page.contentEn);
  return {
    titleFa: page.titleFa,
    titleEn: page.titleEn,
    eyebrowFa: fa.eyebrow ?? '',
    eyebrowEn: en.eyebrow ?? '',
    introFa: fa.intro ?? '',
    introEn: en.intro ?? '',
    paragraphsFa: fa.paragraphs?.length ? fa.paragraphs : emptyParagraphs(),
    paragraphsEn: en.paragraphs?.length ? en.paragraphs : emptyParagraphs(),
    seoDescriptionFa: page.seo?.description ?? '',
    seoDescriptionEn: page.seo?.descriptionEn ?? '',
    published: page.published,
  };
}

function cleanParagraphs(items: string[]) {
  return items.map((item) => item.trim()).filter(Boolean);
}

export function CmsManager() {
  const { locale } = useTranslations();
  const fa = isDefaultLocale(locale);
  const queryClient = useQueryClient();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [form, setForm] = useState<CmsForm | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['admin-cms'],
    queryFn: () => api<CmsPage[]>('/admin/cms'),
  });

  const selected = query.data?.find((page) => page.slug === selectedSlug) ?? query.data?.[0];

  useEffect(() => {
    if (!form && selected) {
      setSelectedSlug(selected.slug);
      setForm(formOf(selected));
    }
  }, [form, selected]);

  const save = useMutation({
    mutationFn: async (payload: CmsForm) => {
      const paragraphsFa = cleanParagraphs(payload.paragraphsFa);
      const paragraphsEn = cleanParagraphs(payload.paragraphsEn);
      if (!paragraphsFa.length || !paragraphsEn.length)
        throw new Error(
          fa ? 'حداقل یک پاراگراف برای هر زبان وارد کنید.' : 'Add at least one paragraph in each language.',
        );

      return api<CmsPage>(`/admin/cms/${encodeURIComponent(selected?.slug ?? '')}`, {
        method: 'PUT',
        body: JSON.stringify({
          titleFa: payload.titleFa.trim(),
          titleEn: payload.titleEn.trim(),
          contentFa: {
            eyebrow: payload.eyebrowFa.trim(),
            intro: payload.introFa.trim(),
            paragraphs: paragraphsFa,
          },
          contentEn: {
            eyebrow: payload.eyebrowEn.trim(),
            intro: payload.introEn.trim(),
            paragraphs: paragraphsEn,
          },
          seo: {
            description: payload.seoDescriptionFa.trim(),
            descriptionEn: payload.seoDescriptionEn.trim(),
          },
          published: payload.published,
        }),
      });
    },
    onSuccess: (page) => {
      queryClient.setQueryData<CmsPage[]>(['admin-cms'], (pages) =>
        pages?.map((item) => (item.slug === page.slug ? page : item)),
      );
      setSelectedSlug(page.slug);
      setForm(formOf(page));
      setValidationError(null);
    },
  });

  function selectPage(page: CmsPage) {
    setSelectedSlug(page.slug);
    setForm(formOf(page));
    setValidationError(null);
    save.reset();
  }

  function updateForm(patch: Partial<CmsForm>) {
    setForm((current) => (current ? { ...current, ...patch } : current));
    setValidationError(null);
    if (save.isError) save.reset();
  }

  function updateParagraph(language: 'fa' | 'en', index: number, value: string) {
    if (!form) return;
    const key = language === 'fa' ? 'paragraphsFa' : 'paragraphsEn';
    updateForm({ [key]: form[key].map((item, itemIndex) => (itemIndex === index ? value : item)) });
  }

  function addParagraph(language: 'fa' | 'en') {
    if (!form) return;
    const key = language === 'fa' ? 'paragraphsFa' : 'paragraphsEn';
    updateForm({ [key]: [...form[key], ''] });
  }

  function removeParagraph(language: 'fa' | 'en', index: number) {
    if (!form) return;
    const key = language === 'fa' ? 'paragraphsFa' : 'paragraphsEn';
    const next = form[key].filter((_, itemIndex) => itemIndex !== index);
    updateForm({ [key]: next.length ? next : [''] });
  }

  if (query.isLoading)
    return (
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="skeleton h-[520px] rounded-3xl" />
        <div className="skeleton h-[720px] rounded-3xl" />
      </div>
    );

  if (query.isError)
    return (
      <div role="alert" className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800">
        <p className="font-black">
          {apiMessage(query.error, fa ? 'صفحات محتوا دریافت نشدند.' : 'CMS pages could not be loaded.')}
        </p>
        <button type="button" onClick={() => query.refetch()} className="mt-4 secondary-button">
          <RefreshCw size={16} />
          {fa ? 'تلاش دوباره' : 'Try again'}
        </button>
      </div>
    );

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black text-purple">{fa ? 'محتوای قابل انتشار' : 'Publishable content'}</p>
          <h1 className="mt-2 text-3xl font-black">{fa ? 'مدیریت صفحات سایت' : 'Site content manager'}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
            {fa
              ? 'صفحه‌ای را انتخاب کنید، متن فارسی و انگلیسی را ویرایش کنید و نتیجه را همان‌جا ذخیره کنید.'
              : 'Choose a page, edit both languages, and save the published version from one workspace.'}
          </p>
        </div>
        <button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className="secondary-button">
          <RefreshCw size={16} className={query.isFetching ? 'animate-spin' : ''} />
          {fa ? 'به‌روزرسانی فهرست' : 'Refresh pages'}
        </button>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="panel-card overflow-hidden">
          <div className="border-b hairline p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-black">{fa ? 'صفحات عمومی' : 'Public pages'}</h2>
              <span className="status-pill status-info">{query.data?.length ?? 0}</span>
            </div>
            <p className="mt-2 text-xs leading-6 text-muted">
              {fa
                ? 'صفحات لینک‌شده در سایت از این فهرست استفاده می‌کنند.'
                : 'These are the pages linked from the public site.'}
            </p>
          </div>
          <div className="grid gap-1 p-2">
            {query.data?.map((page) => {
              const active = page.slug === selected?.slug;
              return (
                <button
                  key={page.slug}
                  type="button"
                  onClick={() => selectPage(page)}
                  className={`flex w-full items-center gap-3 rounded-xl p-3 text-start ${active ? 'bg-lavender text-purple' : 'hover:bg-canvas'}`}
                >
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-lg ${active ? 'bg-white' : 'bg-canvas'}`}
                  >
                    <FileText size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">
                      {localized({ fa: page.titleFa, en: page.titleEn }, locale)}
                    </strong>
                    <small className="latin mt-1 block truncate text-xs text-muted">/{page.slug}</small>
                  </span>
                  <span
                    className={`size-2 shrink-0 rounded-full ${page.published ? 'bg-emerald-500' : 'bg-amber-400'}`}
                  />
                </button>
              );
            })}
          </div>
        </aside>

        {selected && form ? (
          <form
            className="panel-card p-5 sm:p-7"
            onSubmit={(event) => {
              event.preventDefault();
              const titleFa = form.titleFa.trim();
              const titleEn = form.titleEn.trim();
              if (!titleFa || !titleEn) {
                setValidationError(fa ? 'عنوان هر دو زبان را وارد کنید.' : 'Add a title in both languages.');
                return;
              }
              setValidationError(null);
              save.mutate({ ...form, titleFa, titleEn });
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b hairline pb-5">
              <div>
                <span className={`status-pill ${form.published ? 'status-success' : 'status-warning'}`}>
                  {form.published ? (fa ? 'منتشرشده' : 'Published') : fa ? 'پیش‌نویس' : 'Draft'}
                </span>
                <h2 className="mt-3 text-2xl font-black">
                  {localized({ fa: selected.titleFa, en: selected.titleEn }, locale)}
                </h2>
                <p className="latin mt-1 text-xs text-muted">/{selected.slug}</p>
              </div>
              <Link
                href={localePath(`/${selected.slug}`, locale)}
                target="_blank"
                rel="noreferrer"
                className="secondary-button"
              >
                <ExternalLink size={16} />
                {fa ? 'پیش‌نمایش صفحه' : 'Preview page'}
              </Link>
            </div>

            <div className="mt-6 grid gap-5">
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  label="عنوان فارسی"
                  value={form.titleFa}
                  onChange={(value) => updateForm({ titleFa: value })}
                  required
                />
                <TextField
                  label="English title"
                  value={form.titleEn}
                  onChange={(value) => updateForm({ titleEn: value })}
                  dir="ltr"
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  label="برچسب بالای صفحه"
                  hint="اختیاری"
                  value={form.eyebrowFa}
                  onChange={(value) => updateForm({ eyebrowFa: value })}
                />
                <TextField
                  label="Page eyebrow"
                  hint="Optional"
                  value={form.eyebrowEn}
                  onChange={(value) => updateForm({ eyebrowEn: value })}
                  dir="ltr"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <TextArea
                  label="معرفی کوتاه فارسی"
                  value={form.introFa}
                  onChange={(value) => updateForm({ introFa: value })}
                  rows={3}
                />
                <TextArea
                  label="English intro"
                  value={form.introEn}
                  onChange={(value) => updateForm({ introEn: value })}
                  dir="ltr"
                  rows={3}
                />
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <Paragraphs
                  title="متن فارسی"
                  items={form.paragraphsFa}
                  onChange={(index, value) => updateParagraph('fa', index, value)}
                  onAdd={() => addParagraph('fa')}
                  onRemove={(index) => removeParagraph('fa', index)}
                />
                <Paragraphs
                  title="English content"
                  items={form.paragraphsEn}
                  onChange={(index, value) => updateParagraph('en', index, value)}
                  onAdd={() => addParagraph('en')}
                  onRemove={(index) => removeParagraph('en', index)}
                  dir="ltr"
                />
              </div>

              <div className="border-t hairline pt-5">
                <h3 className="font-black">{fa ? 'تنظیمات انتشار و SEO' : 'Publishing and SEO'}</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <TextArea
                    label="توضیح SEO فارسی"
                    value={form.seoDescriptionFa}
                    onChange={(value) => updateForm({ seoDescriptionFa: value })}
                    rows={3}
                  />
                  <TextArea
                    label="English SEO description"
                    value={form.seoDescriptionEn}
                    onChange={(value) => updateForm({ seoDescriptionEn: value })}
                    dir="ltr"
                    rows={3}
                  />
                </div>
                <label className="mt-4 flex items-center gap-3 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(event) => updateForm({ published: event.target.checked })}
                    className="size-4 accent-purple"
                  />
                  {fa ? 'این صفحه در سایت منتشر شود' : 'Publish this page on the public site'}
                </label>
              </div>
            </div>

            {(validationError || save.isError) && (
              <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {validationError ??
                  apiMessage(save.error, fa ? 'ذخیره صفحه انجام نشد.' : 'The page could not be saved.')}
              </p>
            )}
            {save.isSuccess && !validationError && (
              <p role="status" className="mt-5 rounded-xl bg-lavender p-4 text-sm font-bold text-purple">
                {fa ? 'تغییرات صفحه ذخیره شد.' : 'Page changes saved.'}
              </p>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => selectPage(selected)} className="secondary-button">
                {fa ? 'بازگردانی تغییرات' : 'Discard changes'}
              </button>
              <button type="submit" disabled={save.isPending} className="primary-button">
                <Save size={17} />
                {save.isPending ? (fa ? 'در حال ذخیره...' : 'Saving...') : fa ? 'ذخیره تغییرات' : 'Save changes'}
              </button>
            </div>
          </form>
        ) : (
          <div className="panel-card p-10 text-center text-muted">
            {fa ? 'صفحه‌ای برای ویرایش انتخاب کنید.' : 'Select a page to edit.'}
          </div>
        )}
      </div>
    </div>
  );
}

function TextField({
  label,
  hint,
  value,
  onChange,
  dir,
  required,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  dir?: 'ltr' | 'rtl';
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-sm font-bold">
        {label}
        {hint && <small className="font-normal text-muted">({hint})</small>}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        dir={dir}
        required={required}
        maxLength={200}
        className="input"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  dir,
  rows = 5,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  dir?: 'ltr' | 'rtl';
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        dir={dir}
        rows={rows}
        className="input min-h-0 resize-y leading-8"
      />
    </label>
  );
}

function Paragraphs({
  title,
  items,
  onChange,
  onAdd,
  onRemove,
  dir,
}: {
  title: string;
  items: string[];
  onChange: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  dir?: 'ltr' | 'rtl';
}) {
  return (
    <section className="rounded-2xl border hairline bg-canvas/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-black">{title}</h3>
        <button type="button" onClick={onAdd} className="secondary-button !px-3 !py-2 text-xs">
          <Plus size={15} />
          افزودن بند
        </button>
      </div>
      <div className="mt-4 grid gap-3">
        {items.map((item, index) => (
          <div key={index} className="flex items-start gap-2">
            <textarea
              aria-label={`${title} ${index + 1}`}
              value={item}
              onChange={(event) => onChange(index, event.target.value)}
              dir={dir}
              rows={4}
              className="input min-h-0 flex-1 resize-y leading-8"
              required
            />
            <button
              type="button"
              onClick={() => onRemove(index)}
              aria-label={`حذف بند ${index + 1}`}
              title={`حذف بند ${index + 1}`}
              className="grid size-10 shrink-0 place-items-center rounded-xl text-red-600 hover:bg-red-50"
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
