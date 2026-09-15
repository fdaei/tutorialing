'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Eye, EyeOff, GripVertical, ImagePlus, Plus, Save, Trash2, Upload } from 'lucide-react';
import { useTranslations } from '@/components/shared/locale-provider';
import { isDefaultLocale } from '@/lib/i18n';
import { api, apiMessage } from '@/shared/services/api';
import { uploadPanelFile } from '@/features/panel/services/upload-panel-file';
import { defaultLandingConfig, localizedText, mediaReference, normalizeLandingConfig, type LandingConfig, type LandingSectionId, type LocaleText, type SectionStyle } from '@/features/landing';
import { PUBLIC_NAVIGATION_QUERY_KEY } from '@/features/navigation/navigation-config';
import { brandAssets } from '@/config';
import { cn } from '@/shared/components/ui/cn';

type Setting = { key: string; value: unknown; public: boolean };
type BuilderTab = 'builder' | 'theme' | 'media' | 'header-footer';

const sectionTypeOptions: Array<[LandingSectionId, string, string]> = [
  ['hero', 'هیرو', 'Hero'],
  ['languages', 'زبان‌ها', 'Languages'],
  ['benefits', 'مزیت‌ها', 'Benefits'],
  ['placement', 'تعیین سطح', 'Placement'],
  ['courses', 'دوره‌ها', 'Courses'],
  ['blog', 'مجله', 'Journal'],
  ['faq', 'سؤالات متداول', 'FAQ'],
  ['finalCta', 'دعوت نهایی', 'Final CTA'],
];

const iconOptions = [
  ['sparkles', 'Sparkles'],
  ['target', 'Target'],
  ['headphones', 'Support'],
  ['bar-chart', 'Progress'],
] as const;

function cloneConfig(config: LandingConfig): LandingConfig {
  return JSON.parse(JSON.stringify(config)) as LandingConfig;
}

function itemAt<T>(items: T[], index: number): T {
  return items[index]!;
}

function newSection(type: LandingSectionId, copyFrom?: LandingConfig['sections'][number]) {
  const defaults = defaultLandingConfig.sections.find((section) => section.type === type)!;
  return {
    ...(copyFrom ?? defaults),
    id: `${type}-${Date.now()}`,
    label: copyFrom ? { fa: `${copyFrom.label.fa} کپی`, en: `${copyFrom.label.en} copy` } : defaults.label,
  };
}

export function WebsiteBuilder() {
  const { locale } = useTranslations();
  const fa = isDefaultLocale(locale);
  const qc = useQueryClient();
  const [tab, setTab] = useState<BuilderTab>('builder');
  const [selectedId, setSelectedId] = useState('hero');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<LandingConfig>(defaultLandingConfig);

  const settings = useQuery({
    queryKey: ['admin-website-builder-settings'],
    queryFn: () => api<Setting[]>('/admin/settings'),
  });

  useEffect(() => {
    if (!settings.data) return;
    const landing = settings.data.find((setting) => setting.key === 'landing.page')?.value;
    const theme = settings.data.find((setting) => setting.key === 'theme.settings')?.value;
    setDraft(normalizeLandingConfig({ ...(landing && typeof landing === 'object' ? landing : {}), theme }));
  }, [settings.data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = cloneConfig(draft);
      const theme = payload.theme;
      await api('/admin/settings/landing.page', {
        method: 'PUT',
        body: JSON.stringify({ value: payload, public: true }),
      });
      return api('/admin/settings/theme.settings', {
        method: 'PUT',
        body: JSON.stringify({ value: theme, public: true }),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-website-builder-settings'] });
      void qc.invalidateQueries({ queryKey: PUBLIC_NAVIGATION_QUERY_KEY });
    },
  });

  const selected = draft.sections.find((section) => section.id === selectedId) ?? draft.sections[0];
  const selectedLabel = selected ? localizedText(selected.label, locale) : '';

  const update = (recipe: (config: LandingConfig) => void) => {
    setDraft((current) => {
      const next = cloneConfig(current);
      recipe(next);
      return normalizeLandingConfig(next);
    });
  };

  const moveSection = (id: string, toId: string) => {
    if (id === toId) return;
    update((config) => {
      const from = config.sections.findIndex((section) => section.id === id);
      const to = config.sections.findIndex((section) => section.id === toId);
      if (from < 0 || to < 0) return;
      const [item] = config.sections.splice(from, 1);
      if (!item) return;
      config.sections.splice(to, 0, item);
    });
  };

  if (settings.isLoading) return <div className="skeleton h-[760px] rounded-3xl" />;

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black text-purple">{fa ? 'Website Builder' : 'Website Builder'}</p>
          <h1 className="mt-2 text-3xl font-black">{fa ? 'سازنده صفحه اصلی LingoSpeak' : 'LingoSpeak page builder'}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">
            {fa ? 'سکشن‌ها، محتوا، تصویرها، رنگ‌ها و تنظیمات اصلی Landing Page از همین بخش ذخیره می‌شوند.' : 'Manage landing sections, content, media, colors, and global page settings from one workspace.'}
          </p>
        </div>
        <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="primary-button">
          <Save size={17} />
          {save.isPending ? (fa ? 'در حال ذخیره...' : 'Saving...') : fa ? 'ذخیره و انتشار' : 'Save and publish'}
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        {(['builder', 'theme', 'media', 'header-footer'] as BuilderTab[]).map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-xl px-4 py-2 text-sm font-black ${tab === item ? 'bg-purple text-white' : 'border hairline bg-white'}`}>
            {labelForTab(item, fa)}
          </button>
        ))}
      </div>

      {(save.isError || settings.isError) && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {apiMessage(save.error ?? settings.error, fa ? 'تنظیمات سایت ذخیره یا دریافت نشد.' : 'Website settings could not be loaded or saved.')}
        </p>
      )}
      {save.isSuccess && <p role="status" className="rounded-xl bg-lavender p-4 text-sm font-bold text-purple">{fa ? 'تنظیمات صفحه اصلی منتشر شد.' : 'Landing page settings published.'}</p>}

      {tab === 'builder' && (
        <div className="grid items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="panel-card overflow-hidden">
            <div className="border-b hairline p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-black">{fa ? 'سکشن‌ها' : 'Sections'}</h2>
                <select
                  aria-label={fa ? 'افزودن سکشن' : 'Add section'}
                  className="input max-w-[170px] !py-2 text-xs"
                  value=""
                  onChange={(event) => {
                    if (!event.target.value) return;
                    const section = newSection(event.target.value as LandingSectionId);
                    update((config) => config.sections.push(section));
                    setSelectedId(section.id);
                    event.target.value = '';
                  }}
                >
                  <option value="">{fa ? 'افزودن سکشن' : 'Add section'}</option>
                  {sectionTypeOptions.map(([type, labelFa, labelEn]) => <option key={type} value={type}>{fa ? labelFa : labelEn}</option>)}
                </select>
              </div>
            </div>
            <div className="grid gap-2 p-3">
              {draft.sections.map((section) => (
                <button
                  draggable
                  key={section.id}
                  type="button"
                  onClick={() => setSelectedId(section.id)}
                  onDragStart={() => setDraggingId(section.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => draggingId && moveSection(draggingId, section.id)}
                  className={`flex items-center gap-3 rounded-2xl border p-3 text-start ${selectedId === section.id ? 'border-purple bg-lavender text-purple' : 'hairline bg-white hover:bg-canvas'}`}
                >
                  <GripVertical size={17} />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">{localizedText(section.label, locale)}</strong>
                    <small className="latin block text-xs text-muted">{section.type}</small>
                  </span>
                  <span className="grid size-8 place-items-center rounded-lg bg-white/70">{section.visible ? <Eye size={15} /> : <EyeOff size={15} />}</span>
                </button>
              ))}
            </div>
          </aside>

          {selected && (
            <section className="panel-card p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b hairline pb-5">
                <div>
                  <p className="latin text-xs font-black text-purple">{selected.type}</p>
                  <h2 className="mt-2 text-2xl font-black">{selectedLabel}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="secondary-button" onClick={() => update((config) => {
                    const section = config.sections.find((item) => item.id === selected.id);
                    if (section) section.visible = !section.visible;
                  })}>{selected.visible ? <EyeOff size={16} /> : <Eye size={16} />}{selected.visible ? (fa ? 'مخفی' : 'Hide') : fa ? 'نمایش' : 'Show'}</button>
                  <button type="button" className="secondary-button" onClick={() => update((config) => {
                    const index = config.sections.findIndex((section) => section.id === selected.id);
                    config.sections.splice(index + 1, 0, newSection(selected.type, selected));
                  })}><Copy size={16} />{fa ? 'Duplicate' : 'Duplicate'}</button>
                  <button type="button" className="secondary-button !text-red-600" onClick={() => update((config) => {
                    config.sections = config.sections.filter((section) => section.id !== selected.id);
                    setSelectedId(config.sections[0]?.id ?? 'hero');
                  })}><Trash2 size={16} />{fa ? 'حذف' : 'Delete'}</button>
                </div>
              </div>

              <div className="mt-6 grid gap-7">
                <SectionMetaEditor section={selected} fa={fa} onChange={(patch) => update((config) => {
                  const section = config.sections.find((item) => item.id === selected.id);
                  if (section) Object.assign(section, patch);
                })} />
                <ContentEditor config={draft} section={selected} fa={fa} onChange={update} />
                <SectionStyleEditor style={selected.style} fa={fa} onChange={(style) => update((config) => {
                  const section = config.sections.find((item) => item.id === selected.id);
                  if (section) section.style = style;
                })} />
              </div>
            </section>
          )}
        </div>
      )}

      {tab === 'theme' && <ThemeEditor config={draft} fa={fa} onChange={update} />}
      {tab === 'media' && <MediaManager config={draft} fa={fa} onChange={update} />}
      {tab === 'header-footer' && <HeaderFooterEditor config={draft} fa={fa} onChange={update} />}
    </div>
  );
}

function labelForTab(tab: BuilderTab, fa: boolean) {
  const labels: Record<BuilderTab, [string, string]> = {
    builder: ['Page Builder', 'Page Builder'],
    theme: ['Theme Settings', 'Theme Settings'],
    media: ['Media Library', 'Media Library'],
    'header-footer': ['Header / Footer', 'Header / Footer'],
  };
  return fa ? labels[tab][0] : labels[tab][1];
}

function SectionMetaEditor({ section, fa, onChange }: { section: LandingConfig['sections'][number]; fa: boolean; onChange: (patch: Partial<LandingConfig['sections'][number]>) => void }) {
  return (
    <fieldset className="grid gap-4 rounded-2xl border hairline bg-canvas/40 p-4">
      <legend className="px-2 text-sm font-black">{fa ? 'Content' : 'Content'}</legend>
      <div className="grid gap-4 md:grid-cols-2">
        <TextPair labelFa="نام سکشن" labelEn="Section label" value={section.label} onChange={(label) => onChange({ label })} />
        <label className="flex items-center gap-3 pt-7 text-sm font-bold">
          <input type="checkbox" className="size-5 accent-purple" checked={section.visible} onChange={(event) => onChange({ visible: event.target.checked })} />
          {fa ? 'این سکشن نمایش داده شود' : 'Show this section'}
        </label>
      </div>
    </fieldset>
  );
}

function ContentEditor({ config, section, fa, onChange }: { config: LandingConfig; section: LandingConfig['sections'][number]; fa: boolean; onChange: (recipe: (config: LandingConfig) => void) => void }) {
  if (section.type === 'hero') {
    return <fieldset className="grid gap-4"><legend className="text-sm font-black">{fa ? 'Hero Content' : 'Hero Content'}</legend>
      <TextPair labelFa="عنوان Hero" labelEn="Hero title" value={config.hero.title} onChange={(value) => onChange((draft) => { draft.hero.title = value; })} />
      <TextPair labelFa="توضیح Hero" labelEn="Hero description" value={config.hero.description} area onChange={(value) => onChange((draft) => { draft.hero.description = value; })} />
      <div className="grid gap-4 md:grid-cols-2"><ButtonEditor title={fa ? 'دکمه اصلی' : 'Primary button'} value={config.hero.primaryButton} onChange={(value) => onChange((draft) => { draft.hero.primaryButton = value; })} /><ButtonEditor title={fa ? 'دکمه دوم' : 'Secondary button'} value={config.hero.secondaryButton} onChange={(value) => onChange((draft) => { draft.hero.secondaryButton = value; })} /></div>
      <div className="grid gap-4 md:grid-cols-2"><MediaField label={fa ? 'تصویر Hero' : 'Hero image'} value={config.hero.image} onChange={(image) => onChange((draft) => { draft.hero.image = image; })} fa={fa} /><Field label={fa ? 'جایگاه تصویر' : 'Image side'}><select className="input" value={config.hero.imageSide} onChange={(event) => onChange((draft) => { draft.hero.imageSide = event.target.value as 'left' | 'right'; })}><option value="right">{fa ? 'راست' : 'Right'}</option><option value="left">{fa ? 'چپ' : 'Left'}</option></select></Field></div>
    </fieldset>;
  }
  if (section.type === 'languages') {
    return <fieldset className="grid gap-4"><legend className="text-sm font-black">{fa ? 'Languages Content' : 'Languages Content'}</legend>
      <TextPair labelFa="عنوان زبان‌ها" labelEn="Languages title" value={config.languages.title} onChange={(value) => onChange((draft) => { draft.languages.title = value; })} />
      <TextPair labelFa="توضیح زبان‌ها" labelEn="Languages description" value={config.languages.description} area onChange={(value) => onChange((draft) => { draft.languages.description = value; })} />
      <Repeater title={fa ? 'کارت‌های زبان' : 'Language cards'} onAdd={() => onChange((draft) => draft.languages.cards.push({ code: 'new', image: draft.hero.image, accent: '#ede9fe', description: { fa: 'توضیح زبان', en: 'Language description' } }))}>{config.languages.cards.map((card, index) => <div key={`${card.code}-${index}`} className="grid gap-3 rounded-2xl border hairline p-4 md:grid-cols-3"><Field label="Code"><input className="input" value={card.code} onChange={(event) => onChange((draft) => { itemAt(draft.languages.cards, index).code = event.target.value; })} /></Field><Field label={fa ? 'رنگ کارت' : 'Card color'}><input type="color" className="h-12 w-full rounded-xl border hairline" value={card.accent} onChange={(event) => onChange((draft) => { itemAt(draft.languages.cards, index).accent = event.target.value; })} /></Field><MediaField label={fa ? 'تصویر' : 'Image'} value={card.image} fa={fa} onChange={(image) => onChange((draft) => { itemAt(draft.languages.cards, index).image = image; })} /><div className="md:col-span-3"><TextPair labelFa="توضیح" labelEn="Description" value={card.description} area onChange={(value) => onChange((draft) => { itemAt(draft.languages.cards, index).description = value; })} /></div></div>)}</Repeater>
    </fieldset>;
  }
  if (section.type === 'benefits') {
    return <fieldset className="grid gap-4"><legend className="text-sm font-black">{fa ? 'Benefits Content' : 'Benefits Content'}</legend>
      <TextPair labelFa="عنوان مزیت‌ها" labelEn="Benefits title" value={config.benefits.title} onChange={(value) => onChange((draft) => { draft.benefits.title = value; })} />
      <Repeater title={fa ? 'کارت‌های مزیت' : 'Benefit cards'} onAdd={() => onChange((draft) => draft.benefits.items.push({ icon: 'sparkles', title: { fa: 'مزیت جدید', en: 'New benefit' }, description: { fa: 'توضیح', en: 'Description' } }))}>{config.benefits.items.map((item, index) => <div key={`${item.title.en}-${index}`} className="grid gap-3 rounded-2xl border hairline p-4 md:grid-cols-[180px_1fr]"><Field label={fa ? 'آیکون' : 'Icon'}><select className="input" value={item.icon} onChange={(event) => onChange((draft) => { itemAt(draft.benefits.items, index).icon = event.target.value; })}>{iconOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field><TextPair labelFa="عنوان" labelEn="Title" value={item.title} onChange={(value) => onChange((draft) => { itemAt(draft.benefits.items, index).title = value; })} /><div className="md:col-span-2"><TextPair labelFa="توضیح" labelEn="Description" value={item.description} area onChange={(value) => onChange((draft) => { itemAt(draft.benefits.items, index).description = value; })} /></div></div>)}</Repeater>
    </fieldset>;
  }
  if (section.type === 'placement') {
    return <SimpleCtaEditor title={fa ? 'Banner تعیین سطح' : 'Placement banner'} image={config.placement.image} background={config.placement.backgroundColor} copy={{ eyebrow: config.placement.eyebrow, title: config.placement.title, description: config.placement.description, button: config.placement.button }} fa={fa} onChange={(patch) => onChange((draft) => { Object.assign(draft.placement, patch); })} />;
  }
  if (section.type === 'courses') return <SectionCopyEditor title={fa ? 'Courses Section' : 'Courses Section'} value={config.courses} fa={fa} onChange={(value) => onChange((draft) => { draft.courses = value; })} />;
  if (section.type === 'blog') return <SectionCopyEditor title={fa ? 'Blog Section' : 'Blog Section'} value={config.blog} fa={fa} onChange={(value) => onChange((draft) => { draft.blog = value; })} />;
  if (section.type === 'faq') {
    return <fieldset className="grid gap-4"><legend className="text-sm font-black">{fa ? 'FAQ Content' : 'FAQ Content'}</legend>
      <TextPair labelFa="عنوان FAQ" labelEn="FAQ title" value={config.faq.title} onChange={(value) => onChange((draft) => { draft.faq.title = value; })} />
      <Repeater title={fa ? 'سوال‌ها' : 'Questions'} onAdd={() => onChange((draft) => draft.faq.items.push({ question: { fa: 'سوال جدید', en: 'New question' }, answer: { fa: 'پاسخ', en: 'Answer' } }))}>{config.faq.items.map((item, index) => <div key={`${item.question.en}-${index}`} className="grid gap-3 rounded-2xl border hairline p-4"><TextPair labelFa="سوال" labelEn="Question" value={item.question} onChange={(value) => onChange((draft) => { itemAt(draft.faq.items, index).question = value; })} /><TextPair labelFa="پاسخ" labelEn="Answer" value={item.answer} area onChange={(value) => onChange((draft) => { itemAt(draft.faq.items, index).answer = value; })} /></div>)}</Repeater>
    </fieldset>;
  }
  return <SimpleCtaEditor title={fa ? 'CTA آخر صفحه' : 'Final CTA'} background={config.finalCta.backgroundColor} copy={{ eyebrow: config.finalCta.eyebrow, title: config.finalCta.title, button: config.finalCta.button }} fa={fa} onChange={(patch) => onChange((draft) => { Object.assign(draft.finalCta, patch); })} />;
}

function SectionCopyEditor({ title, value, fa, onChange }: { title: string; value: LandingConfig['courses']; fa: boolean; onChange: (value: LandingConfig['courses']) => void }) {
  return <fieldset className="grid gap-4"><legend className="text-sm font-black">{title}</legend><TextPair labelFa="برچسب" labelEn="Eyebrow" value={value.eyebrow} onChange={(eyebrow) => onChange({ ...value, eyebrow })} /><TextPair labelFa="عنوان" labelEn="Title" value={value.title} onChange={(title) => onChange({ ...value, title })} /><TextPair labelFa="توضیح" labelEn="Description" value={value.description} area onChange={(description) => onChange({ ...value, description })} /></fieldset>;
}

function SimpleCtaEditor({ title, copy, image, background, fa, onChange }: { title: string; copy: { eyebrow: LocaleText; title: LocaleText; description?: LocaleText; button: { label: LocaleText; href: string } }; image?: string; background: string; fa: boolean; onChange: (patch: Record<string, unknown>) => void }) {
  return <fieldset className="grid gap-4"><legend className="text-sm font-black">{title}</legend><TextPair labelFa="برچسب" labelEn="Eyebrow" value={copy.eyebrow} onChange={(eyebrow) => onChange({ eyebrow })} /><TextPair labelFa="عنوان" labelEn="Title" value={copy.title} onChange={(value) => onChange({ title: value })} />{copy.description && <TextPair labelFa="توضیح" labelEn="Description" value={copy.description} area onChange={(description) => onChange({ description })} />}<ButtonEditor title={fa ? 'دکمه' : 'Button'} value={copy.button} onChange={(button) => onChange({ button })} /><div className="grid gap-4 md:grid-cols-2">{image !== undefined && <MediaField label={fa ? 'تصویر' : 'Image'} value={image} fa={fa} onChange={(value) => onChange({ image: value })} />}<Field label={fa ? 'رنگ پس‌زمینه' : 'Background'}><input type="color" className="h-12 w-full rounded-xl border hairline" value={background} onChange={(event) => onChange({ backgroundColor: event.target.value })} /></Field></div></fieldset>;
}

function SectionStyleEditor({ style, fa, onChange }: { style: SectionStyle; fa: boolean; onChange: (style: SectionStyle) => void }) {
  const patch = (value: Partial<SectionStyle>) => onChange({ ...style, ...value });
  return (
    <fieldset className="grid gap-4 rounded-2xl border hairline bg-canvas/40 p-4">
      <legend className="px-2 text-sm font-black">{fa ? 'Style / Responsive' : 'Style / Responsive'}</legend>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label={fa ? 'رنگ پس‌زمینه' : 'Background'}><input type="color" className="h-12 w-full rounded-xl border hairline" value={style.backgroundColor || '#ffffff'} onChange={(event) => patch({ backgroundColor: event.target.value })} /></Field>
        <Field label={fa ? 'Padding' : 'Padding'}><input className="input" value={style.padding ?? ''} placeholder="80px" onChange={(event) => patch({ padding: event.target.value })} /></Field>
        <Field label={fa ? 'Radius' : 'Radius'}><input className="input" value={style.borderRadius ?? ''} placeholder="24px" onChange={(event) => patch({ borderRadius: event.target.value })} /></Field>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label={fa ? 'Shadow' : 'Shadow'}><input className="input" value={style.shadow ?? ''} placeholder="0 18px 55px rgba(...)" dir="ltr" onChange={(event) => patch({ shadow: event.target.value })} /></Field>
        <Field label={fa ? 'چینش متن' : 'Text alignment'}><select className="input" value={style.textAlign ?? 'start'} onChange={(event) => patch({ textAlign: event.target.value as SectionStyle['textAlign'] })}><option value="start">Start</option><option value="center">Center</option><option value="end">End</option></select></Field>
        <Field label={fa ? 'Margin' : 'Margin'}><input className="input" value={style.margin ?? ''} placeholder="0" onChange={(event) => patch({ margin: event.target.value })} /></Field>
      </div>
      <div className="flex flex-wrap gap-4 text-sm font-bold">
        {(['desktop', 'tablet', 'mobile'] as const).map((key) => <label key={key} className="flex items-center gap-2"><input type="checkbox" className="accent-purple" checked={style[key] !== false} onChange={(event) => patch({ [key]: event.target.checked })} />{key}</label>)}
      </div>
    </fieldset>
  );
}

function ThemeEditor({ config, fa, onChange }: { config: LandingConfig; fa: boolean; onChange: (recipe: (config: LandingConfig) => void) => void }) {
  const setTheme = (key: keyof LandingConfig['theme'], value: string) => onChange((draft) => { draft.theme[key] = value; });
  return <section className="panel-card grid gap-5 p-6"><h2 className="text-2xl font-black">{fa ? 'Appearance > Theme Settings' : 'Appearance > Theme Settings'}</h2><div className="grid gap-4 md:grid-cols-4">{(['primary', 'secondary', 'button', 'background'] as const).map((key) => <Field key={key} label={key}><input type="color" className="h-12 w-full rounded-xl border hairline" value={config.theme[key]} onChange={(event) => setTheme(key, event.target.value)} /></Field>)}</div><div className="grid gap-4 md:grid-cols-3"><Field label="Global radius"><input className="input" value={config.theme.radius} onChange={(event) => setTheme('radius', event.target.value)} /></Field><Field label="Global shadow"><input className="input" dir="ltr" value={config.theme.shadow} onChange={(event) => setTheme('shadow', event.target.value)} /></Field><Field label="Container width"><input className="input" value={config.theme.containerWidth} onChange={(event) => setTheme('containerWidth', event.target.value)} /></Field></div><h3 className="text-lg font-black">{fa ? 'تایپوگرافی' : 'Typography'}</h3><div className="grid gap-4 md:grid-cols-3"><Field label={fa ? 'فونت سایت' : 'Site font'}><select className="input" value={config.theme.fontFamily} onChange={(event) => setTheme('fontFamily', event.target.value)}>{(Object.keys(SITE_FONTS) as SiteFont[]).map((key) => <option key={key} value={key} style={{ fontFamily: SITE_FONTS[key].stack }}>{SITE_FONTS[key].label}</option>)}</select></Field><Field label={fa ? 'اندازه پایه فونت (px)' : 'Base font size (px)'}><input className="input" type="number" min={14} max={19} step={0.5} value={Number.parseFloat(config.theme.baseFontSize)} onChange={(event) => setTheme('baseFontSize', `${event.target.value}px`)} /></Field><Field label={fa ? 'ضخامت تیترها' : 'Heading weight'}><select className="input" value={config.theme.headingWeight} onChange={(event) => setTheme('headingWeight', event.target.value)}>{HEADING_WEIGHTS.map((weight) => <option key={weight} value={weight}>{weight}</option>)}</select></Field></div><p className="rounded-xl border hairline p-4 text-lg" style={{ fontFamily: SITE_FONTS[config.theme.fontFamily].stack }}><strong style={{ fontWeight: Number(config.theme.headingWeight) }}>{fa ? 'پیش‌نمایش تیتر' : 'Heading preview'}</strong> — {fa ? 'برای حرف‌زدن آماده شو، نه فقط حفظ‌کردن. ۱۲۳۴' : 'Learn to speak, not just memorize.'}</p></section>;
}

function MediaManager({ config, fa, onChange }: { config: LandingConfig; fa: boolean; onChange: (recipe: (config: LandingConfig) => void) => void }) {
  return <section className="panel-card grid gap-5 p-6"><h2 className="text-2xl font-black">{fa ? 'Media Library' : 'Media Library'}</h2><div className="grid gap-4 md:grid-cols-2"><MediaField label={fa ? 'Hero image' : 'Hero image'} value={config.hero.image} fa={fa} onChange={(value) => onChange((draft) => { draft.hero.image = value; })} /><MediaField label={fa ? 'Placement image' : 'Placement image'} value={config.placement.image} fa={fa} onChange={(value) => onChange((draft) => { draft.placement.image = value; })} /></div><div className="grid gap-4 md:grid-cols-3">{config.languages.cards.map((card, index) => <MediaField key={`${card.code}-${index}`} label={`${fa ? 'Language card' : 'Language card'} ${card.code}`} value={card.image} fa={fa} onChange={(value) => onChange((draft) => { itemAt(draft.languages.cards, index).image = value; })} />)}</div></section>;
}

function HeaderFooterEditor({ config, fa, onChange }: { config: LandingConfig; fa: boolean; onChange: (recipe: (config: LandingConfig) => void) => void }) {
  return <section className="panel-card grid gap-7 p-6"><div className="grid gap-4 md:grid-cols-3"><Field label="Logo text"><input className="input" value={config.brand.name} onChange={(event) => onChange((draft) => { draft.brand.name = event.target.value; })} /></Field><Field label="Logo mark"><input className="input" value={config.brand.mark} onChange={(event) => onChange((draft) => { draft.brand.mark = event.target.value; })} /></Field><Field label={fa ? 'رنگ Header' : 'Header color'}><input type="color" className="h-12 w-full rounded-xl border hairline" value={config.header.background} onChange={(event) => onChange((draft) => { draft.header.background = event.target.value; })} /></Field></div><MediaField label={fa ? 'لوگوی سایت' : 'Site logo'} value={config.brand.logo} fa={fa} fit="contain" fallback={brandAssets.logo} onChange={(value) => onChange((draft) => { draft.brand.logo = value; })} /><label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" className="size-5 accent-purple" checked={config.header.sticky} onChange={(event) => onChange((draft) => { draft.header.sticky = event.target.checked; })} />{fa ? 'Header sticky باشد' : 'Sticky header'}</label><Repeater title={fa ? 'منوهای Header' : 'Header menus'} onAdd={() => onChange((draft) => draft.header.nav.push({ id: `nav-${Date.now()}`, label: { fa: 'منوی جدید', en: 'New item' }, href: '/', visible: true }))}>{config.header.nav.map((item, index) => <div key={item.id} className="grid gap-3 rounded-2xl border hairline p-4 md:grid-cols-[1fr_160px_90px]"><TextPair labelFa="عنوان منو" labelEn="Menu label" value={item.label} onChange={(label) => onChange((draft) => { itemAt(draft.header.nav, index).label = label; })} /><Field label="URL"><input className="input" dir="ltr" value={item.href} onChange={(event) => onChange((draft) => { itemAt(draft.header.nav, index).href = event.target.value; })} /></Field><label className="flex items-center gap-2 pt-7 text-sm font-bold"><input type="checkbox" className="accent-purple" checked={item.visible} onChange={(event) => onChange((draft) => { itemAt(draft.header.nav, index).visible = event.target.checked; })} />{fa ? 'نمایش' : 'Show'}</label></div>)}</Repeater><TextPair labelFa="متن معرفی Footer" labelEn="Footer description" value={config.footer.description} area onChange={(value) => onChange((draft) => { draft.footer.description = value; })} /><div className="grid gap-4 md:grid-cols-3"><Field label={fa ? 'تلفن' : 'Phone'}><input className="input" value={config.footer.phone} onChange={(event) => onChange((draft) => { draft.footer.phone = event.target.value; })} /></Field><Field label="Email"><input className="input" dir="ltr" value={config.footer.email} onChange={(event) => onChange((draft) => { draft.footer.email = event.target.value; })} /></Field><TextPair labelFa="آدرس" labelEn="Address" value={config.footer.address} onChange={(value) => onChange((draft) => { draft.footer.address = value; })} /></div></section>;
}

function Repeater({ title, onAdd, children }: { title: string; onAdd: () => void; children: React.ReactNode }) {
  return <div className="grid gap-3"><div className="flex items-center justify-between gap-3"><h3 className="font-black">{title}</h3><button type="button" onClick={onAdd} className="secondary-button !py-2 text-xs"><Plus size={15} />Add</button></div>{children}</div>;
}

function TextPair({ labelFa, labelEn, value, area, onChange }: { labelFa: string; labelEn: string; value: LocaleText; area?: boolean; onChange: (value: LocaleText) => void }) {
  return <div className="grid gap-3 md:grid-cols-2"><Field label={labelFa}>{area ? <textarea className="input min-h-28 leading-8" value={value.fa} onChange={(event) => onChange({ ...value, fa: event.target.value })} /> : <input className="input" value={value.fa} onChange={(event) => onChange({ ...value, fa: event.target.value })} />}</Field><Field label={labelEn}>{area ? <textarea className="input min-h-28 leading-8" dir="ltr" value={value.en} onChange={(event) => onChange({ ...value, en: event.target.value })} /> : <input className="input" dir="ltr" value={value.en} onChange={(event) => onChange({ ...value, en: event.target.value })} />}</Field></div>;
}

function ButtonEditor({ title, value, onChange }: { title: string; value: { label: LocaleText; href: string }; onChange: (value: { label: LocaleText; href: string }) => void }) {
  return <div className="grid gap-3 rounded-2xl border hairline p-4"><h3 className="font-black">{title}</h3><TextPair labelFa="متن دکمه" labelEn="Button label" value={value.label} onChange={(label) => onChange({ ...value, label })} /><Field label="Link"><input className="input" dir="ltr" value={value.href} onChange={(event) => onChange({ ...value, href: event.target.value })} /></Field></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold">{label}</span>{children}</label>;
}

function MediaField({ label, value, fa, fit = 'cover', fallback, onChange }: { label: string; value: string; fa: boolean; fit?: 'cover' | 'contain'; fallback?: string; onChange: (value: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(value);
  useEffect(() => {
    const id = mediaReference(value);
    if (!id) {
      setPreview(value);
      return;
    }
    api<{ url: string }>(`/files/public/${id}`).then((result) => setPreview(result.url)).catch(() => setPreview(''));
  }, [value]);
  return <div className="rounded-2xl border hairline p-4"><div className="mb-3 flex items-center justify-between gap-3"><strong className="text-sm">{label}</strong><ImagePlus size={18} className="text-purple" /></div>{preview || fallback ? <img src={preview || fallback} alt="" className={cn('h-32 w-full rounded-xl', fit === 'contain' ? 'bg-canvas object-contain p-4' : 'object-cover')} /> : <div className="grid h-32 place-items-center rounded-xl bg-canvas text-muted"><ImagePlus /></div>}<input className="input mt-3" value={value} dir="ltr" onChange={(event) => onChange(event.target.value)} placeholder={fallback ?? '/images/...'} /><label className="secondary-button mt-3 cursor-pointer"><Upload size={16} />{busy ? (fa ? 'در حال آپلود...' : 'Uploading...') : fa ? 'آپلود تصویر' : 'Upload image'}<input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async (event) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    const target = event.currentTarget;
    setBusy(true);
    try {
      const id = await uploadPanelFile(file, 'website-media', fa);
      onChange(`media:${id}`);
    } finally {
      setBusy(false);
      target.value = '';
    }
  }} /></label></div>;
}
