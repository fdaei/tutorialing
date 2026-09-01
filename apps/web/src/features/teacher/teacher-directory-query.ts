export function normalizeTeacherLanguage(value: string | null | undefined) {
  return value && /^[a-z]{2,12}$/i.test(value) ? value.toLowerCase() : '';
}

export function teacherDirectoryEndpoint({
  page,
  search,
  skill,
  language,
  minRating,
  sort,
}: {
  page: number;
  search: string;
  skill: string;
  language: string;
  minRating: string;
  sort: string;
}) {
  const query = new URLSearchParams({
    page: String(page),
    limit: '9',
    search,
    skill,
    language: normalizeTeacherLanguage(language),
    minRating,
    sort,
  });
  return `/teachers?${query.toString()}`;
}
