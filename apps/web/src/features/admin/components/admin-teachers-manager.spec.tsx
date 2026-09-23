import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/components/shared/locale-provider';
import { api } from '@/shared/services/api';
import { AdminTeachersManager } from './admin-teachers-manager';

// Only the network call is stubbed. Listing the module's exports by hand is
// what broke this suite before: the editor started reading per-field validation
// errors through `apiField`, which the hand-written double did not have, and the
// dialog crashed instead of rendering.
jest.mock('@/shared/services/api', () => ({
  ...jest.requireActual('@/shared/services/api'),
  api: jest.fn(),
}));
jest.mock('@/features/panel/services/upload-panel-file', () => ({ uploadPanelFile: jest.fn() }));

const apiMock = jest.mocked(api);
const language = { id: 'lang-1', nameFa: 'انگلیسی', nameEn: 'English', flag: null };
const row = {
  id: 'teacher-1',
  slug: 'sara-1',
  nameFa: 'سارا',
  nameEn: 'Sara',
  status: 'APPROVED',
  rating: 4.5,
  reviewsCount: 3,
  experienceYears: 5,
  approvedTrialPrice: null,
  approvedRegularPrice: null,
  avatarUrl: null,
  user: { phone: '09120000000', email: null },
  languageLinks: [{ language }],
};
const detail = {
  ...row,
  bioFa: 'ب'.repeat(50),
  bioEn: 'b'.repeat(50),
  specialties: ['IELTS'],
  gender: null,
  lessonDuration: 60,
  trialDuration: 30,
  breakMinutes: 0,
  trialPrice: 0,
  regularPrice: 0,
  languageLinks: [{ languageId: 'lang-1', levels: ['B1'], language }],
};

function renderManager() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <LocaleProvider locale="fa">
      <QueryClientProvider client={client}>
        <AdminTeachersManager />
      </QueryClientProvider>
    </LocaleProvider>,
  );
}

describe('AdminTeachersManager', () => {
  beforeEach(() => {
    apiMock.mockImplementation((path) => {
      const url = String(path);
      if (url === '/languages') return Promise.resolve([language]);
      if (url === '/admin/teachers/teacher-1') return Promise.resolve(detail);
      return Promise.resolve({ data: [row], page: 1, totalPages: 1, total: 1 });
    });
  });

  afterEach(() => apiMock.mockReset());

  it('lists teachers from the admin teachers endpoint', async () => {
    renderManager();
    expect(await screen.findByText('سارا')).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledWith(expect.stringContaining('/admin/teachers?page=1'));
  });

  it('loads a teacher into the editor and saves changes with PATCH', async () => {
    renderManager();
    fireEvent.click(await screen.findByRole('button', { name: /ویرایش/ }));
    expect(await screen.findByRole('dialog', { name: 'ویرایش مدرس' })).toBeInTheDocument();

    const nameInput = await screen.findByDisplayValue('سارا');
    fireEvent.change(nameInput, { target: { value: 'سارا رضایی' } });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره تغییرات' }));

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        '/admin/teachers/teacher-1',
        expect.objectContaining({ method: 'PATCH' }),
      ),
    );
    const call = apiMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
    const body = JSON.parse(String(call?.[1]?.body));
    expect(body).toMatchObject({ nameFa: 'سارا رضایی', languageIds: ['lang-1'], levels: ['B1'], email: null });
    expect(body).not.toHaveProperty('avatarFileId');
    expect(await screen.findByText('تغییرات ذخیره شد.')).toBeInTheDocument();
  });
});
