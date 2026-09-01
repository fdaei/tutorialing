import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { LocaleProvider } from '@/components/shared/locale-provider';
import { api } from '@/shared/services/api';
import { AdminUsersManager } from './admin-users-manager';

jest.mock('@/shared/services/api', () => ({
  api: jest.fn(),
  ApiError: class ApiError extends Error {},
  Paginated: {},
}));

const apiMock = jest.mocked(api);
const user = {
  id: 'user-1',
  name: 'سارا',
  phone: '09120000000',
  status: 'ACTIVE',
  locale: 'fa',
  createdAt: '2026-01-01T00:00:00.000Z',
  roles: [{ role: 'STUDENT' }],
};

function renderManager() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <LocaleProvider locale="fa">
      <QueryClientProvider client={client}>
        <AdminUsersManager />
      </QueryClientProvider>
    </LocaleProvider>,
  );
}

describe('AdminUsersManager', () => {
  beforeEach(() => {
    apiMock.mockImplementation((path) =>
      Promise.resolve(
        String(path).includes('/user-1')
          ? { ...user, bookings: [], attempts: [], payments: [], tickets: [], learningPlans: [], _count: {} }
          : { data: [user], page: 1, totalPages: 1, total: 1 },
      ),
    );
  });

  afterEach(() => apiMock.mockReset());

  it('exposes accessible search controls', async () => {
    renderManager();
    expect(screen.getByRole('textbox', { name: 'جستجو با نام، موبایل یا ایمیل' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'وضعیت' })).toBeInTheDocument();
    expect(await screen.findByText('سارا')).toBeInTheDocument();
  });

  it('opens user details as a modal dialog and closes it with Escape', async () => {
    renderManager();
    fireEvent.click(await screen.findByRole('button', { name: /جزئیات/ }));

    expect(await screen.findByRole('dialog', { name: 'سارا' })).toHaveAttribute('aria-modal', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
