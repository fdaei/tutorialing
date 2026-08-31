export type BlogPostSummary = {
  id: string;
  slug: string;
  titleFa: string;
  titleEn: string;
  excerptFa: string;
  excerptEn: string;
  coverImage?: string | null;
  category?: { nameFa: string; nameEn: string } | null;
  author?: { name: string | null } | null;
};

export type BlogPostsPage = {
  items: BlogPostSummary[];
  page: number;
  pageSize: number;
};

export type BlogPostDetail = BlogPostSummary & {
  contentFa: string;
  contentEn: string;
  seoTitleFa?: string | null;
  seoTitleEn?: string | null;
  seoDescriptionFa?: string | null;
  seoDescriptionEn?: string | null;
  _count?: { views?: number; comments?: number };
};
