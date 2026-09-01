export type LessonType = 'VIDEO' | 'AUDIO' | 'TEXT' | 'QUIZ';
export type CourseLesson = {
  id: string;
  titleFa: string;
  titleEn: string;
  descriptionFa?: string;
  descriptionEn?: string;
  type: LessonType;
  content?: unknown;
  mediaUrl?: string;
  durationSeconds: number;
  order: number;
  preview?: boolean;
  published?: boolean;
  attachments: { id: string; title: string; url: string; mimeType?: string }[];
};
export type CourseChapter = {
  id: string;
  titleFa: string;
  titleEn: string;
  order: number;
  published?: boolean;
  lessons: CourseLesson[];
};
export type LessonProgress = { lessonId: string; positionSeconds: number; completedAt?: string; lastViewedAt: string };
export type CoursePlayerPayload = {
  enrollmentId: string;
  completedAt?: string;
  lastLessonId?: string;
  completedLessons: number;
  totalLessons: number;
  progressPercent: number;
  progress: LessonProgress[];
  course: { id: string; slug: string; titleFa: string; titleEn: string; chapters: CourseChapter[] };
};
export type LearningEnrollment = {
  id: string;
  completedAt?: string;
  lastLesson?: { id: string; titleFa: string; titleEn: string };
  completedLessons: number;
  progressPercent: number;
  course: {
    id: string;
    slug: string;
    titleFa: string;
    titleEn: string;
    image?: string;
    level: string;
    language: string;
    lessonsCount: number;
  };
};
export type InstructorCourse = {
  id: string;
  slug: string;
  titleFa: string;
  titleEn: string;
  published: boolean;
  level: string;
  language: string;
  updatedAt: string;
  _count: { chapters: number; enrollments: number };
};
export type InstructorCurriculum = InstructorCourse & { chapters: CourseChapter[] };
