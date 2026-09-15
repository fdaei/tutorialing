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
  it('filters courses by language', () => {
    render(<CourseDirectory courses={courses} />);

    fireEvent.change(screen.getByLabelText('زبان'), { target: { value: 'آلمانی' } });

    expect(screen.queryByText('مکالمه انگلیسی')).not.toBeInTheDocument();
    expect(screen.getByText('شروع آلمانی')).toBeInTheDocument();
    expect(screen.getByText('۱ دوره')).toBeInTheDocument();
  });

  it('filters by course type, delivery and search text', () => {
    const catalog: Course[] = [
      { ...courses[0]!, slug: 'term', category: 'private-class', delivery: 'IN_PERSON' },
      { ...courses[0]!, slug: 'essay', title: 'تصحیح رایتینگ', category: 'writing-correction', delivery: 'ONLINE' },
    ];
    render(<CourseDirectory courses={catalog} />);

    fireEvent.click(screen.getByRole('button', { name: /تصحیح رایتینگ/ }));
    expect(screen.getAllByRole('article')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /همه انواع/ }));
    fireEvent.change(screen.getByLabelText('نحوه برگزاری'), { target: { value: 'IN_PERSON' } });
    expect(screen.getByRole('heading', { name: 'مکالمه انگلیسی' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'حذف فیلترها' }));
    fireEvent.change(screen.getByLabelText('جستجوی دوره'), { target: { value: 'رایتینگ' } });
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });

  it('only offers filters backed by the live catalogue', () => {
    render(<CourseDirectory courses={courses} />);

    expect(screen.getByRole('option', { name: 'انگلیسی' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'فرانسوی' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('نحوه برگزاری')).not.toBeInTheDocument();
  });

  it('localizes filters, course cards, and links in English', () => {
    render(
      <LocaleProvider locale="en">
        <CourseDirectory courses={courses} />
      </LocaleProvider>,
    );

    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'آلمانی' } });
    expect(screen.getByText('1 courses')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View course' })).toHaveAttribute('href', '/en/courses/german-start');
  });

  it('applies recommendation language and level filters on first render', () => {
    render(<CourseDirectory courses={courses} initialLanguage="انگلیسی" initialLevel="B1" />);

    expect(screen.getByLabelText('زبان')).toHaveValue('انگلیسی');
    expect(screen.getByLabelText('سطح / هدف')).toHaveValue('B1');
    expect(screen.getByText('مکالمه انگلیسی')).toBeInTheDocument();
    expect(screen.queryByText('شروع آلمانی')).not.toBeInTheDocument();
  });
});
