import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/components/shared/locale-provider';
import { api } from '@/shared/services/api';
import { CmsManager } from './cms-manager';

jest.mock('@/shared/services/api', () => ({
  api: jest.fn(),
  apiMessage: (_error: unknown, fallback: string) => fallback,
}));

const apiMock = jest.mocked(api);

const page = {
  id: 'page-about',
  slug: 'about',
  titleFa: 'درباره ما',
  titleEn: 'About us',
  contentFa: {
    eyebrow: 'داستان ما',
    intro: 'معرفی کوتاه',
    paragraphs: ['متن قدیمی درباره ما'],
  },
  contentEn: {
    eyebrow: 'Our story',
    intro: 'A short introduction',
    paragraphs: ['Old about page copy'],
  },
  seo: { description: 'توضیح قدیمی', descriptionEn: 'Old description' },
  published: true,
  updatedAt: '2026-09-11T10:00:00.000Z',
};

function renderManager() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <LocaleProvider locale="fa">
      <QueryClientProvider client={client}>
        <CmsManager />
      </QueryClientProvider>
    </LocaleProvider>,
  );
}

describe('CmsManager', () => {
  beforeEach(() => {
    apiMock.mockImplementation((path, options) =>
      options?.method === 'PUT'
        ? Promise.resolve({
            ...page,
            contentFa: { ...page.contentFa, paragraphs: ['متن جدید درباره ما'] },
          })
        : Promise.resolve([page]),
    );
  });

  afterEach(() => apiMock.mockReset());

  it('loads the about page, saves edited copy, and reports success', async () => {
    renderManager();

    expect(await screen.findByText('صفحات عمومی')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('معرفی کوتاه فارسی'), { target: { value: 'معرفی به‌روز شده' } });
    fireEvent.change(screen.getByLabelText('متن فارسی 1'), { target: { value: 'متن جدید درباره ما' } });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره تغییرات' }));

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        '/admin/cms/about',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('متن جدید درباره ما'),
        }),
      ),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('تغییرات صفحه ذخیره شد.');
  });
});
