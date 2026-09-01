import { teacherCheckoutHref } from './teacher-booking-card';

describe('teacherCheckoutHref', () => {
  it('sends a guest through auth while preserving the complete checkout destination', () => {
    expect(teacherCheckoutHref('teacher/one', false, 'fa')).toBe(
      '/auth?next=%2Fcheckout%3Fteacher%3Dteacher%252Fone',
    );
  });

  it('sends an authenticated user directly to localized checkout', () => {
    expect(teacherCheckoutHref('teacher-1', true, 'en')).toBe('/en/checkout?teacher=teacher-1');
  });

  it('preserves the English checkout destination through guest authentication', () => {
    expect(teacherCheckoutHref('teacher-1', false, 'en')).toBe(
      '/en/auth?next=%2Fen%2Fcheckout%3Fteacher%3Dteacher-1',
    );
  });
});
