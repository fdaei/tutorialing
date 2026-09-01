import { placementRecommendationPaths } from './placement-recommendations';

describe('placementRecommendationPaths', () => {
  it('carries language and level into localized recommendation destinations', () => {
    expect(placementRecommendationPaths('en', 'B1', 'fa')).toEqual({
      courses: '/courses?language=en&level=B1',
      teachers: '/teachers?language=en',
    });
    expect(placementRecommendationPaths('de', 'A2', 'en')).toEqual({
      courses: '/en/courses?language=de&level=A2',
      teachers: '/en/teachers?language=de',
    });
  });
});
