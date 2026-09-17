import { resolveHeaderConfig } from '@/lib/header-config';
import { BlogPageContent } from './blog-page-content';

export default async function BlogPage() {
  const headerConfig = await resolveHeaderConfig();
  return <BlogPageContent headerConfig={headerConfig} />;
}
