import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/components/shared/locale-provider';
import { api } from '@/shared/services/api';
import { CountryManager } from './country-manager';
import { LanguageManager } from './language-manager';

jest.mock('@/shared/services/api', () => ({
  api: jest.fn(),
  apiMessage: (_error: unknown, fallback: string) => fallback,
}));

const apiMock = jest.mocked(api);

function renderManager(manager: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <LocaleProvider locale="fa">
      <QueryClientProvider client={client}>{manager}</QueryClientProvider>
    </LocaleProvider>,
  );
}

describe('admin catalog deletion safeguards', () => {
  afterEach(() => {
    apiMock.mockReset();
    jest.restoreAllMocks();
  });

  it('does not delete a language when permanent deletion is not confirmed', async () => {
    apiMock.mockResolvedValue({
      data: [
        {
          id: 'language-1', code: 'de', nameFa: 'آلمانی', nameEn: 'German', nativeName: 'Deutsch', flag: '🇩🇪',
          direction: 'LTR', proficiencySystem: 'CEFR', active: true, order: 1,
        },
      ],
      page: 1,
      totalPages: 1,
      total: 1,
    });
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    renderManager(<LanguageManager />);

    fireEvent.click(await screen.findByRole('button', { name: 'حذف آلمانی' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('برای همیشه حذف'));
    expect(apiMock).toHaveBeenCalledTimes(1);
  });

  it('clears edited language values when editing is cancelled', async () => {
    apiMock.mockResolvedValue({
      data: [
        {
          id: 'language-1', code: 'de', nameFa: 'آلمانی', nameEn: 'German', nativeName: 'Deutsch', flag: '🇩🇪',
          direction: 'LTR', proficiencySystem: 'CEFR', active: true, order: 1,
        },
      ],
      page: 1,
      totalPages: 1,
      total: 1,
    });
    renderManager(<LanguageManager />);

    fireEvent.click(await screen.findByRole('button', { name: 'ویرایش' }));
    expect(screen.getByLabelText('Code')).toHaveValue('de');
    fireEvent.click(screen.getByRole('button', { name: 'انصراف' }));
    expect(screen.getByLabelText('Code')).toHaveValue('');
    expect(screen.getByLabelText('نام فارسی')).toBeRequired();
  });

  it('reports a failed country deletion without removing the row optimistically', async () => {
    apiMock.mockImplementation((path, options) => {
      if (options?.method === 'DELETE') return Promise.reject(new Error('delete failed'));
      return Promise.resolve({
        data: [
          {
            id: 'country-1', code: 'DE', nameFa: 'آلمان', nameEn: 'Germany', dialCode: '+49', flag: '🇩🇪',
            minLength: 10, maxLength: 11, active: true, order: 1,
          },
        ],
        page: 1,
        totalPages: 1,
        total: 1,
      });
    });
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    renderManager(<CountryManager />);

    expect(screen.getByLabelText('ISO')).toHaveAttribute('pattern', '[A-Z]{2}');
    expect(screen.getByLabelText('پیش‌شماره')).toBeRequired();

    fireEvent.click(await screen.findByRole('button', { name: 'حذف کشور' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('حذف کشور انجام نشد.');
    expect(screen.getByRole('cell', { name: /آلمان/ })).toBeInTheDocument();
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('/admin/countries/country-1', { method: 'DELETE' }),
    );
  });
});
