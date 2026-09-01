import { normalizeTeacherLanguage, teacherDirectoryEndpoint } from './teacher-directory-query';

describe('teacher directory recommendation filters', () => {
  it('applies the placement language to the real teacher API request', () => {
    expect(
      teacherDirectoryEndpoint({
        page: 1,
        search: '',
        skill: '',
        language: 'EN',
        minRating: '',
        sort: 'rating',
      }),
    ).toBe('/teachers?page=1&limit=9&search=&skill=&language=en&minRating=&sort=rating');
  });

  it('drops malformed language filters before they reach the API', () => {
    expect(normalizeTeacherLanguage('../admin')).toBe('');
    expect(normalizeTeacherLanguage('de')).toBe('de');
  });
});
