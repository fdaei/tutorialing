import type { Metadata } from 'next';
import { publicPageMetadata } from '@/lib/public-metadata';

export function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata('/courses', { fa: 'دوره‌های آموزش زبان', en: 'Online language courses' }, {
    fa: 'دوره‌های آنلاین زبان را بر اساس زبان و سطح مقایسه کنید و مسیر مناسب یادگیری خود را پیدا کنید.',
    en: 'Compare online language courses by language and level and find the right learning path.',
  });
}

export default function CoursesLayout({ children }: { children: React.ReactNode }) { return children; }
