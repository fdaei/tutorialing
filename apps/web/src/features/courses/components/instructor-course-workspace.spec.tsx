import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/shared/services/api';
import { InstructorCourseWorkspace } from './instructor-course-workspace';

jest.mock('@/shared/services/api', () => ({
  api: jest.fn(),
  apiMessage: (_error: unknown, fallback: string) => fallback,
}));

const mockedApi = jest.mocked(api);
const course = {
  id: 'course-1',
  slug: 'speaking',
  titleFa: 'مکالمه انگلیسی',
  titleEn: 'English speaking',
  published: true,
  level: 'B1',
  language: 'انگلیسی',
  updatedAt: '2026-08-31T00:00:00.000Z',
  _count: { chapters: 0, enrollments: 3 },
};

function renderWorkspace() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <InstructorCourseWorkspace />
    </QueryClientProvider>,
  );
}

describe('InstructorCourseWorkspace', () => {
  beforeEach(() => {
    mockedApi.mockReset();
    mockedApi.mockImplementation(async (path, init) => {
      if (path === '/instructor/courses' && !init) return [course] as never;
      if (path === '/instructor/courses/course-1/curriculum') return { ...course, chapters: [] } as never;
      if (path === '/instructor/courses/course-1/chapters' && init?.method === 'POST')
        return { id: 'chapter-1' } as never;
      throw new Error(`Unexpected API call: ${path}`);
    });
  });

  it('creates a draft chapter for the selected owned course', async () => {
    renderWorkspace();
    expect(await screen.findByText('مکالمه انگلیسی')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /افزودن فصل/ }));
    fireEvent.change(screen.getByLabelText('عنوان فارسی'), { target: { value: 'فصل نخست' } });
    fireEvent.change(screen.getByLabelText('عنوان انگلیسی'), { target: { value: 'First chapter' } });
    fireEvent.click(screen.getByRole('button', { name: 'ساخت فصل پیش‌نویس' }));

    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith(
        '/instructor/courses/course-1/chapters',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ titleFa: 'فصل نخست', titleEn: 'First chapter', order: 1, published: false }),
        }),
      ),
    );
  });
});
