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
    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(2));
  });

  it('gives the bilingual title fields accessible names', async () => {
    apiMock.mockResolvedValue([]);
    renderManager();

    expect(screen.getByRole('textbox', { name: 'عنوان فارسی' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'English title' })).toBeInTheDocument();
  });
});
