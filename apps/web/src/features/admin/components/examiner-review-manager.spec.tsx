import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { LocaleProvider } from '@/components/shared/locale-provider';
import { api } from '@/shared/services/api';
import { ExaminerReviewManager } from './examiner-review-manager';

jest.mock('@/shared/services/api', () => ({
  api: jest.fn(),
  apiMessage: (_error: unknown, fallback: string) => fallback,
}));

const apiMock = jest.mocked(api);
const answer = {
  id: 'answer-1',
  textValue: 'پاسخ زبان‌آموز',
  reviewStatus: 'PENDING',
  question: { prompt: { fa: 'درباره موضوع بنویسید', en: 'Write about the topic' }, type: 'essay', section: { skill: 'writing', title: 'Writing' } },
  attempt: {
    submittedAt: '2026-01-01T12:00:00.000Z',
    user: { name: 'سارا', phone: '09120000000' },
    test: { titleFa: 'آزمون آزمایشی', titleEn: 'Mock test', language: { nameFa: 'انگلیسی', nameEn: 'English', nativeName: 'English', flag: '🇬🇧' } },
  },
};

function renderManager() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <LocaleProvider locale="fa">
      <QueryClientProvider client={client}>
        <ExaminerReviewManager />
      </QueryClientProvider>
    </LocaleProvider>,
  );
}

describe('ExaminerReviewManager', () => {
  afterEach(() => apiMock.mockReset());

  it('shows a recoverable error when claiming an answer fails', async () => {
    apiMock.mockImplementation((path) =>
      String(path).includes('/claim')
        ? Promise.reject(new Error('claim failed'))
        : Promise.resolve({ items: [answer], pagination: { page: 1, pageSize: 20, total: 1, pages: 1 } }),
    );
    renderManager();

    fireEvent.click(await screen.findByRole('button', { name: /سارا/ }));
    fireEvent.click(screen.getByRole('button', { name: /شروع بررسی/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('صف بررسی دریافت نشد');
  });

  it('marks the active queue tab for assistive technology', async () => {
    apiMock.mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 20, total: 0, pages: 0 } });
    renderManager();
    expect(screen.getByRole('button', { name: 'در انتظار بررسی' })).toHaveAttribute('aria-pressed', 'true');
  });
});
