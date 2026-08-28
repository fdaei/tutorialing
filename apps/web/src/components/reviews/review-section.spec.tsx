import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReviewSection } from './review-section';
import { api, readAccessToken } from '@/shared/services/api';

jest.mock('@/shared/services/api', () => ({
  api: jest.fn(),
  apiMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback,
  readAccessToken: jest.fn(),
}));

const apiMock = jest.mocked(api);
const tokenMock = jest.mocked(readAccessToken);

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  HTMLDialogElement.prototype.close = function close() { this.open = false; };
});

beforeEach(() => {
  jest.clearAllMocks();
  tokenMock.mockReturnValue('access-token');
});

function renderCourseReviews() {
  render(
    <ReviewSection
      subject="course"
      subjectId="course-1"
      title="امتیاز و نظرات دانشجویان"
      rating={0}
      count={0}
      reviews={[]}
      distribution={{}}
    />,
  );
}

describe('ReviewSection', () => {
  it('keeps an unenrolled student disabled using server eligibility', async () => {
    apiMock.mockResolvedValueOnce({ eligible: false, review: null });
    renderCourseReviews();

    fireEvent.click(screen.getByRole('button', { name: 'ثبت نظر و امتیاز' }));

    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByText('برای ثبت نظر باید در این دوره ثبت‌نام کرده باشید.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'ثبت نظر' })).toBeDisabled();
  });

  it('validates locally before issuing a mutation', async () => {
    apiMock.mockResolvedValueOnce({ eligible: true, review: null });
    renderCourseReviews();
    fireEvent.click(screen.getByRole('button', { name: 'ثبت نظر و امتیاز' }));
    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(1));

    fireEvent.click(within(dialog).getByRole('button', { name: 'ثبت نظر' }));

    expect(await within(dialog).findByText('یک امتیاز و نظر کامل وارد کنید.')).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledTimes(1);
  });

  it('creates a course review and synchronizes summary without reloading', async () => {
    apiMock
      .mockResolvedValueOnce({ eligible: true, review: null })
      .mockResolvedValueOnce({
        id: 'review-1', rating: 5, comment: 'این دوره بسیار کاربردی بود.', createdAt: '2026-08-29T00:00:00.000Z',
        user: { name: 'دانشجو' },
      });
    renderCourseReviews();
    fireEvent.click(screen.getByRole('button', { name: 'ثبت نظر و امتیاز' }));
    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(1));
    fireEvent.click(within(dialog).getByLabelText('5 ستاره از ۵'));
    fireEvent.change(within(dialog).getByLabelText('نظر شما'), { target: { value: 'این دوره بسیار کاربردی بود.' } });

    fireEvent.click(within(dialog).getByRole('button', { name: 'ثبت نظر' }));

    expect(await within(dialog).findByText('نظر شما با موفقیت ثبت شد.')).toBeInTheDocument();
    expect(screen.getByText('5.0')).toBeInTheDocument();
    expect(screen.getByText('بر اساس ۱ نظر')).toBeInTheDocument();
    expect(screen.getAllByText('این دوره بسیار کاربردی بود.')).toHaveLength(2);
  });

  it('keeps the dialog state and shows a safe API error', async () => {
    apiMock.mockResolvedValueOnce({ eligible: true, review: null }).mockRejectedValueOnce(new Error('ثبت نظر ناموفق بود.'));
    renderCourseReviews();
    fireEvent.click(screen.getByRole('button', { name: 'ثبت نظر و امتیاز' }));
    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(1));
    fireEvent.click(within(dialog).getByLabelText('5 ستاره از ۵'));
    fireEvent.change(within(dialog).getByLabelText('نظر شما'), { target: { value: 'این دوره بسیار کاربردی بود.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'ثبت نظر' }));

    expect(await within(dialog).findByText('ثبت نظر ناموفق بود.')).toBeInTheDocument();
    expect(dialog).toHaveAttribute('open');
  });
});
