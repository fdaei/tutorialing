import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { LocaleProvider } from '@/components/shared/locale-provider';
import { api } from '@/shared/services/api';
import Admin from './page';

jest.mock('@/shared/services/api', () => ({ api: jest.fn() }));
jest.mock('@/features/panel', () => ({
  adminNav: [],
  PanelShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

const apiMock = jest.mocked(api);

describe('Admin dashboard states', () => {
  afterEach(() => apiMock.mockReset());

  it('does not present failed metrics as real zero values', async () => {
    apiMock.mockRejectedValue(new Error('dashboard unavailable'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <LocaleProvider locale="fa">
        <QueryClientProvider client={client}>
          <Admin />
        </QueryClientProvider>
      </LocaleProvider>,
    );

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(/۰ تومان/)).not.toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
