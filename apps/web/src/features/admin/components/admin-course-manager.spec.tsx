import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/components/shared/locale-provider';
import { api } from '@/shared/services/api';
import { AdminCourseManager } from './admin-course-manager';

jest.mock('@/shared/services/api', () => ({
  api: jest.fn(),
  apiMessage: (_error: unknown, fallback: string) => fallback,
}));

const apiMock = jest.mocked(api);

function renderManager() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <LocaleProvider locale="fa">
      <QueryClientProvider client={client}>
        <AdminCourseManager />
      </QueryClientProvider>
    </LocaleProvider>,
  );
}

const instructor = { id: 'teacher-1', nameFa: 'سارا دادخواه', nameEn: 'Sara Dadkhah', slug: 'sara' };

describe('AdminCourseManager', () => {
  afterEach(() => {
    apiMock.mockReset();
  });

  it('loads the course catalog and approved instructors', async () => {
    apiMock.mockImplementation((path) => {
      if (path === '/admin/courses/instructors') return Promise.resolve([instructor]);
      return Promise.resolve([]);
    });

    renderManager();

    expect(await screen.findByRole('heading', { name: 'مدیریت دوره‌ها' })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'سارا دادخواه' })).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledWith('/admin/courses');
    expect(apiMock).toHaveBeenCalledWith('/admin/courses/instructors');
  });

  it('creates a course through the admin course endpoint', async () => {
    const created = {
      id: 'course-1',
      slug: 'english-start',
      titleFa: 'شروع انگلیسی',
      titleEn: 'English start',
      descriptionFa: 'یک دوره کامل برای شروع مکالمه انگلیسی و تمرین روزانه.',
      descriptionEn: 'A complete course for starting English conversation with daily practice.',
      language: 'انگلیسی',
      level: 'A1',
      teacherId: 'teacher-1',
      teacherName: 'سارا دادخواه',
      lessonsCount: 0,
      price: 1200000,
      published: false,
      rating: 0,
      reviewsCount: 0,
      updatedAt: '2026-09-13T00:00:00.000Z',
      _count: { chapters: 0, enrollments: 0 },
    };
    apiMock.mockImplementation((path, init) => {
      if (path === '/admin/courses/instructors') return Promise.resolve([instructor]);
      if (path === '/admin/courses' && init?.method === 'POST') return Promise.resolve(created);
      return Promise.resolve([]);
    });

    renderManager();

    fireEvent.change(await screen.findByLabelText('Slug'), { target: { value: 'english-start' } });
    fireEvent.change(screen.getByLabelText('عنوان فارسی'), { target: { value: 'شروع انگلیسی' } });
    fireEvent.change(screen.getByLabelText('عنوان انگلیسی'), { target: { value: 'English start' } });
    fireEvent.change(screen.getByLabelText('توضیح فارسی'), { target: { value: created.descriptionFa } });
    fireEvent.change(screen.getByLabelText('توضیح انگلیسی'), { target: { value: created.descriptionEn } });
    fireEvent.change(screen.getByLabelText('زبان دوره'), { target: { value: 'انگلیسی' } });
    fireEvent.change(screen.getByLabelText('مدرس'), { target: { value: 'teacher-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'ساخت دوره' }));

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('/admin/courses', {
        method: 'POST',
        body: expect.stringContaining('"slug":"english-start"'),
      }),
    );
  });
});
