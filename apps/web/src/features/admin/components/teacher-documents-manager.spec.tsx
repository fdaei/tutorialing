import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/components/shared/locale-provider';
import { api } from '@/shared/services/api';
import { TeacherDocumentsManager } from './teacher-documents-manager';

jest.mock('@/shared/services/api', () => ({
  api: jest.fn(),
  apiMessage: (_error: unknown, fallback: string) => fallback,
}));

const apiMock = jest.mocked(api);
const applications = [
  {
    id: 'teacher-1', nameFa: 'مدرس نمونه', nameEn: 'Sample teacher', user: { phone: '09120000000' },
    verificationItems: [
      {
        id: 'document-1', kind: 'IDENTITY', status: 'PENDING',
        file: { id: 'file-1', originalName: 'identity.pdf', mimeType: 'application/pdf', size: 2000 },
      },
    ],
  },
];

function renderManager() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <LocaleProvider locale="fa">
      <QueryClientProvider client={client}>
        <TeacherDocumentsManager />
      </QueryClientProvider>
    </LocaleProvider>,
  );
}

describe('TeacherDocumentsManager', () => {
  beforeEach(() => {
    apiMock.mockImplementation((path) =>
      String(path).includes('/download') ? Promise.resolve({ url: 'https://files.example/identity' }) : Promise.resolve(applications),
    );
  });
  afterEach(() => apiMock.mockReset());

  it('requires an explicit signed-file preparation step before document review', async () => {
    renderManager();
    expect(await screen.findByText('identity.pdf')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /باز کردن فایل/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'آماده‌سازی مشاهده فایل' }));
    const link = await screen.findByRole('link', { name: /باز کردن فایل/ });
    expect(link).toHaveAttribute('href', 'https://files.example/identity');
    expect(apiMock).toHaveBeenCalledWith('/files/file-1/download');
  });

  it('submits the selected review outcome through the verification contract', async () => {
    renderManager();
    await screen.findByText('identity.pdf');
    fireEvent.change(screen.getByRole('combobox', { name: 'نتیجه بررسی' }), { target: { value: 'APPROVED' } });
    fireEvent.click(screen.getByRole('button', { name: 'ثبت نتیجه' }));

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('/admin/verification-items/document-1/review', {
        method: 'POST',
        body: JSON.stringify({ status: 'APPROVED', note: undefined }),
      }),
    );
  });
});
