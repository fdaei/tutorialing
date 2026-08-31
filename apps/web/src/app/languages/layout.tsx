import type { Metadata } from 'next';
import { publicPageMetadata } from '@/lib/public-metadata';

export function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata('/languages', { fa: 'زبان‌های قابل یادگیری', en: 'Languages you can learn' }, {
    fa: 'زبان موردنظر خود را انتخاب کنید و دوره‌ها، مدرس‌ها و مسیر یادگیری متناسب با هدفتان را ببینید.',
    en: 'Choose a language and explore courses, teachers, and a learning path suited to your goal.',
  });
}

export default function LanguagesLayout({ children }: { children: React.ReactNode }) { return children; }
