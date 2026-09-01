import { CoursePlayer } from '@/features/courses/components/course-player';
export default async function LearnPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CoursePlayer slug={slug} />;
}
