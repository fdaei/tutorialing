import type { EducationalLanguage } from '@/features/languages';
import type { Locale } from '@/lib/i18n';

export function TeacherLanguageFilter({
  locale,
  value,
  languages,
  loading,
  error,
  onChange,
}: {
  locale: Locale;
  value: string;
  languages?: EducationalLanguage[];
  loading: boolean;
  error: boolean;
  onChange: (value: string) => void;
}) {
  const english = locale === 'en';
  return (
    <select
      aria-label={english ? 'Language' : 'زبان'}
      value={value}
      disabled={loading || error}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-13 rounded-2xl border hairline px-4"
    >
      <option value="">
        {error
          ? english
            ? 'Languages unavailable'
            : 'زبان‌ها در دسترس نیستند'
          : english
            ? 'All languages'
            : 'همه زبان‌ها'}
      </option>
      {languages?.map((item) => (
        <option key={item.id} value={item.code}>
          {english ? item.nameEn : item.nameFa}
        </option>
      ))}
    </select>
  );
}
