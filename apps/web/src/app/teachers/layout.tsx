import type { Metadata } from 'next';
import { publicPageMetadata } from '@/lib/public-metadata';

export function generateMetadata(): Promise<Metadata> {
  return publicPageMetadata('/teachers', { fa: 'مدرس‌های زبان', en: 'Language teachers' }, {
    fa: 'مدرس‌های تأییدشده زبان را بر اساس تخصص، امتیاز، زبان و هزینه جلسه پیدا و مقایسه کنید.',
    en: 'Find and compare verified language teachers by specialty, rating, language, and lesson price.',
  });
}

export default function TeachersLayout({ children }: { children: React.ReactNode }) { return children; }
