import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/components/shared/locale-provider';
import { api } from '@/shared/services/api';
import { AdminTestManager } from './admin-test-manager';

jest.mock('@/shared/services/api', () => ({
  api: jest.fn(),
  ApiError: class ApiError extends Error {},
}));

const apiMock = jest.mocked(api);

function renderManager() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <LocaleProvider locale="fa">
      <QueryClientProvider client={client}>
        <AdminTestManager />
      </QueryClientProvider>
    </LocaleProvider>,
  );
}

describe('AdminTestManager', () => {
  beforeEach(() => apiMock.mockReset());

  it('distinguishes a load failure from an empty test catalog and supports retry', async () => {
    apiMock.mockRejectedValue(new Error('network unavailable'));
    renderManager();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('هنوز آزمونی ساخته نشده است.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }));
    await waitFor(() =>
      expect(apiMock.mock.calls.filter(([path]) => path === '/admin/tests')).toHaveLength(2),
    );
  });

  it('gives the bilingual title fields accessible names', async () => {
    apiMock.mockResolvedValue([]);
    renderManager();

    expect(screen.getByRole('textbox', { name: 'عنوان فارسی' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'English title' })).toBeInTheDocument();
  });

  it('sends the selected educational language, which the API requires', async () => {
    apiMock.mockImplementation((path: string) =>
      Promise.resolve(
        path === '/languages'
          ? [{ id: 'lang-en', code: 'en', nameFa: 'انگلیسی', nameEn: 'English' }]
          : [],
      ) as never,
    );
    renderManager();

    // The select stays disabled until the language list arrives, and a change
    // event on a disabled control is dropped — wait for the option itself.
    await screen.findByRole('option', { name: 'انگلیسی' });
    fireEvent.change(screen.getByRole('combobox', { name: 'زبان آموزشی' }), { target: { value: 'lang-en' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'عنوان فارسی' }), { target: { value: 'تست' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'English title' }), { target: { value: 'test' } });
    fireEvent.click(screen.getByRole('button', { name: 'ساخت آزمون' }));

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('/admin/tests/simple', {
        method: 'POST',
        body: JSON.stringify({ languageId: 'lang-en', titleFa: 'تست', titleEn: 'test', durationMinutes: 164 }),
      }),
    );
  });

  it('keeps the form unsubmittable while no language can be offered', async () => {
    apiMock.mockResolvedValue([]);
    renderManager();

    await waitFor(() => expect(screen.getByRole('button', { name: 'ساخت آزمون' })).toBeDisabled());
  });
});
