export type BlogSeedPost = {
  slug: string;
  category: string;
  tags: readonly string[];
  titleFa: string;
  titleEn: string;
  excerptFa: string;
  excerptEn: string;
  seoTitleFa: string;
  seoTitleEn: string;
  seoDescriptionFa: string;
  seoDescriptionEn: string;
  // Markdown rendered by apps/web BlogMarkdown: #/##/### headings, paragraphs,
  // - and 1. lists, > quotes ("> نکته:" renders as a tip box), **bold**, [links](/path).
  contentFa: string;
  contentEn: string;
};
