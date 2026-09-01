import { adminDeleteConfirmation } from './admin-confirmation';

describe('adminDeleteConfirmation', () => {
  it('makes permanent deletion explicit in both locales', () => {
    expect(adminDeleteConfirmation('آلمانی', 'fa')).toContain('برای همیشه حذف');
    expect(adminDeleteConfirmation('German', 'en')).toContain('permanently deleted');
  });
});
