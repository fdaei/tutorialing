import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { CourseDirectory } from './course-directory';
import type { Course } from '@/lib/marketplace-data';

jest.mock('next/image', () => ({ __esModule: true, default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} /> }));

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

  it('guides users back to all courses when a language has no results', () => {
    render(<CourseDirectory courses={courses} />);

    fireEvent.click(screen.getByRole('button', { name: 'فرانسوی' }));
    expect(screen.getByText('برای این زبان هنوز دوره‌ای منتشر نشده است')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'نمایش همه دوره‌ها' }));
    expect(screen.getByText('مکالمه انگلیسی')).toBeInTheDocument();
    expect(screen.getByText('شروع آلمانی')).toBeInTheDocument();
  });
});
