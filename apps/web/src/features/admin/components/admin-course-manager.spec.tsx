import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/components/shared/locale-provider';
import { api } from '@/shared/services/api';
import { AdminCourseManager } from './admin-course-manager';

jest.mock('@/shared/services/api', () => ({
  ...jest.requireActual('@/shared/services/api'),
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

const livePackage = {
  id: 'package-1',
  titleFa: 'ده جلسه آیلتس',
  titleEn: 'IELTS, ten sessions',
  credits: 10,
  active: true,
  course: { id: 'course-live' },
};
const instructor = {
  id: 'teacher-1',
  nameFa: 'سارا دادخواه',
  nameEn: 'Sara Dadkhah',
  slug: 'sara',
  packages: [livePackage],
};

const liveCourse = {
  id: 'course-live',
  slug: 'ielts-live',
  titleFa: 'آیلتس زنده',
  titleEn: 'IELTS live',
  descriptionFa: 'کلاس زنده آیلتس با تمرین هفتگی و بازخورد مدرس.',
  descriptionEn: 'A live IELTS class with weekly practice and instructor feedback.',
  language: 'انگلیسی',
  level: 'IELTS',
  teacherId: 'teacher-1',
  teacherName: 'سارا دادخواه',
  format: 'LIVE_ONLINE' as const,
  packageId: 'package-1',
  lessonsCount: 10,
  price: 9000000,
  published: true,
  rating: 0,
  reviewsCount: 0,
  updatedAt: '2026-09-13T00:00:00.000Z',
  _count: { chapters: 0, enrollments: 4 },
};

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

  // A PATCH that omits `format`/`packageId` makes the API fall back to
  // SELF_PACED, which unlinks the package and then rejects the save with
  // COURSE_PUBLISH_REQUIRES_LESSONS. Every catalog course is LIVE_ONLINE, so
  // dropping either field breaks editing outright.
  it('keeps the live format, package and free-text level when editing a course', async () => {
    apiMock.mockImplementation((path, init) => {
      if (path === '/admin/courses/instructors') return Promise.resolve([instructor]);
      if (path === '/admin/courses' && !init) return Promise.resolve([liveCourse]);
      if (path === `/admin/courses/${liveCourse.id}` && init?.method === 'PATCH')
        return Promise.resolve(liveCourse);
      return Promise.resolve([]);
    });

    renderManager();

    fireEvent.click(await screen.findByRole('button', { name: 'ویرایش' }));

    expect(await screen.findByLabelText('سطح')).toHaveValue('IELTS');
    expect(screen.getByLabelText('نوع دوره')).toHaveValue('LIVE_ONLINE');
    expect(screen.getByLabelText('پکیج جلسات')).toHaveValue('package-1');

    fireEvent.click(screen.getByRole('button', { name: 'ذخیره تغییرات' }));

    await waitFor(() => {
      const call = apiMock.mock.calls.find(([path, init]) => init?.method === 'PATCH' && path.endsWith(liveCourse.id));
      expect(call).toBeDefined();
      expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
        level: 'IELTS',
        format: 'LIVE_ONLINE',
        packageId: 'package-1',
      });
    });
  });
});
