import {direction,formatDate,localePath,translate} from './i18n';

describe('localization primitives',()=>{
  it('preserves an equivalent route while changing its locale prefix',()=>{
    expect(localePath('/teachers?page=2','en')).toBe('/en/teachers?page=2');
    expect(localePath('/en/teachers','fa')).toBe('/teachers');
    expect(localePath('/','en')).toBe('/en');
  });
  it('uses Persian fallback keys and correct directions',()=>{
    expect(translate('fa','teachers')).toBe('مدرس‌ها');
    expect(direction('fa')).toBe('rtl');expect(direction('en')).toBe('ltr');
  });
  // Money assertions moved to money.spec.ts along with the formatter itself.
  it('localizes dates without mutating source values',()=>{
    expect(formatDate('2026-07-16T12:00:00Z','fa')).not.toEqual(formatDate('2026-07-16T12:00:00Z','en'));
  });
});
