import { authPath, direction, formatDate, formatMoney, localePath, localized, localeTag, resolveLocale, translate } from './i18n';

describe('localization primitives', () => {
  it('preserves an equivalent route while changing its locale prefix', () => {
    expect(localePath('/teachers?page=2', 'en')).toBe('/en/teachers?page=2');
    expect(localePath('/en/teachers', 'fa')).toBe('/teachers');
    expect(localePath('/', 'en')).toBe('/en');
  });
  it('builds localized authentication routes with encoded return destinations', () => {
    expect(authPath('/en/admin/users?status=active', 'en')).toBe(
      '/en/auth?next=%2Fen%2Fadmin%2Fusers%3Fstatus%3Dactive',
    );
    expect(authPath('/dashboard', 'fa')).toBe('/auth?next=%2Fdashboard');
  });
  it('uses Persian fallback keys and correct directions', () => {
    expect(translate('fa', 'teachers')).toBe('مدرس‌ها');
    expect(direction('fa')).toBe('rtl');
    expect(direction('en')).toBe('ltr');
    expect(localeTag('fa')).toBe('fa-IR');
  });
  it('normalizes missing or unsupported locale values to the safe default', () => {
    expect(resolveLocale(undefined)).toBe('fa');
    expect(resolveLocale(null)).toBe('fa');
    expect(resolveLocale('de')).toBe('fa');
    expect(resolveLocale('en')).toBe('en');
  });
  it('selects localized API fields and falls back to the default locale', () => {
    expect(localized({ fa: 'عنوان', en: 'Title' }, 'en')).toBe('Title');
    expect(localized({ fa: 'عنوان' }, 'en')).toBe('عنوان');
  });
  it('localizes dates and prices without mutating source values', () => {
    expect(formatMoney(1250000, 'fa')).toContain('۱٬۲۵۰٬۰۰۰');
    expect(formatMoney(1250000, 'en')).toContain('1,250,000');
    expect(formatDate('2026-07-16T12:00:00Z', 'fa')).not.toEqual(formatDate('2026-07-16T12:00:00Z', 'en'));
  });
});
