import type { Metadata } from 'next';
import { publicPageMetadata } from '@/lib/public-metadata';

export function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata('/blog', { fa: 'مجله یادگیری زبان', en: 'Language learning magazine' }, {
    fa: 'راهنماهای کاربردی برای یادگیری زبان، برنامه‌ریزی مطالعه، مکالمه و آمادگی آزمون.',
    en: 'Practical guides for language learning, study planning, speaking, and exam preparation.',
  });
}

export default function BlogLayout({ children }: { children: React.ReactNode }) { return children; }
