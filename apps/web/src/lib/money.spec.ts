import { formatMoney, formatMoneyOrDash, formatNumber, moneyUnit } from './money';

describe('money formatting', () => {
  // FIN-101. Storage is Toman, but every money site used to label the same
  // integer 'IRR' for English readers -- understating every price tenfold. The
  // old i18n.spec.ts asserted digit grouping only and never looked at the unit,
  // which is exactly why the bug survived. These assertions are on the label.
  it('labels the amount as Toman in both locales, never IRR (FIN-101)', () => {
    expect(formatMoney(500_000, 'fa')).toContain('تومان');
    expect(formatMoney(500_000, 'en')).toContain('Toman');
    expect(formatMoney(500_000, 'en')).not.toContain('IRR');
    expect(formatMoney(500_000, 'fa')).not.toContain('IRR');
  });

  it('shows the same figure in both locales, only the script differs', () => {
    expect(formatMoney(500_000, 'fa')).toContain('۵۰۰٬۰۰۰');
    expect(formatMoney(500_000, 'en')).toContain('500,000');
  });

  it('groups digits in the locale numerals', () => {
    expect(formatNumber(1_250_000, 'fa')).toBe('۱٬۲۵۰٬۰۰۰');
    expect(formatNumber(1_250_000, 'en')).toBe('1,250,000');
  });

  it('exposes the bare unit for form labels', () => {
    expect(moneyUnit('fa')).toBe('تومان');
    expect(moneyUnit('en')).toBe('Toman');
  });

  it('renders a missing amount as an em dash rather than "0 Toman"', () => {
    expect(formatMoneyOrDash(null, 'en')).toBe('—');
    expect(formatMoneyOrDash(undefined, 'fa')).toBe('—');
    expect(formatMoneyOrDash(0, 'en')).toBe('0 Toman');
  });
});
