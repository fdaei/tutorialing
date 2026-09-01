import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { CourseDirectory } from './course-directory';
import type { Course } from '@/lib/marketplace-data';
import { LocaleProvider } from '@/components/shared/locale-provider';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

const courses: Course[] = [
  {
    slug: 'english-speaking',
    title: 'مکالمه انگلیسی',
    language: 'انگلیسی',
    level: 'B1',
    rating: 4.8,
    lessons: 12,
    price: 2_000_000,
    image: null,
  },
  {
    slug: 'german-start',
    title: 'شروع آلمانی',
    language: 'آلمانی',
    level: 'A1',
    rating: 4.7,
    lessons: 10,
    price: 1_800_000,
    image: null,
  },
];

describe('CourseDirectory', () => {
  it('filters courses by language and exposes the selected state', () => {
    render(<CourseDirectory courses={courses} />);

    expect(screen.getByText('مکالمه انگلیسی')).toBeInTheDocument();
    expect(screen.getByText('شروع آلمانی')).toBeInTheDocument();

    const germanFilter = screen.getByRole('button', { name: 'آلمانی' });
    fireEvent.click(germanFilter);

    expect(germanFilter).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('مکالمه انگلیسی')).not.toBeInTheDocument();
    expect(screen.getByText('شروع آلمانی')).toBeInTheDocument();
    expect(screen.getByText('۱ دوره')).toBeInTheDocument();
  });

  it('only offers filters backed by the live catalogue', () => {
    render(<CourseDirectory courses={courses} />);

    expect(screen.getByRole('button', { name: 'انگلیسی' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'آلمانی' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'فرانسوی' })).not.toBeInTheDocument();
  });

  it('localizes filters, results, course cards, and links in English', () => {
    render(
      <LocaleProvider locale="en">
        <CourseDirectory courses={courses} />
      </LocaleProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'German' }));
    expect(screen.getByRole('heading', { name: 'German courses' })).toBeInTheDocument();
    expect(screen.getByText('1 courses')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View course' })).toHaveAttribute('href', '/en/courses/german-start');
  });
});
