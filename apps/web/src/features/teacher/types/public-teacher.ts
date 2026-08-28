import type { EducationalLanguage } from '@/features/languages';

export type TeacherLanguage = { language: EducationalLanguage; levels: string[]; specialties: string[] };
export type PublicTeacher = {
  id: string;
  slug: string;
  nameFa: string;
  nameEn: string;
  bioFa: string;
  bioEn?: string;
  rating: number;
  reviewsCount: number;
  trialPrice: number;
  regularPrice?: number;
  approvedTrialPrice?: number;
  approvedRegularPrice?: number;
  trialDuration?: number;
  lessonDuration: number;
  specialties: string[];
  languages: string[];
  languageLinks?: TeacherLanguage[];
  targetBands: number[];
  introVideoKey?: string;
  approvedAt: string;
  successfulClasses?: number;
  studentsCount?: number;
  packages?: unknown[];
  reviews?: Array<{
    id: string; rating: number; comment: string | null; createdAt: string;
    student?: { name?: string | null; avatarKey?: string | null };
  }>;
  distribution?: Record<string, number>;
  policy?: { titleFa: string; titleEn: string; rules: unknown };
};
