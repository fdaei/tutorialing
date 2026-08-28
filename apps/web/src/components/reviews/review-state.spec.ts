import { applyRatingChange } from './review-state';

describe('applyRatingChange', () => {
  const initial = { rating: 4, count: 2, distribution: { 3: 1, 5: 1 } };

  it('updates average, count and distribution when a review is created', () => {
    expect(applyRatingChange(initial, null, 5)).toEqual({
      rating: 4.3,
      count: 3,
      distribution: { 3: 1, 5: 2 },
    });
  });

  it('keeps count stable when a review is edited', () => {
    expect(applyRatingChange(initial, 3, 5)).toEqual({
      rating: 5,
      count: 2,
      distribution: { 3: 0, 5: 2 },
    });
  });

  it('resets an empty summary when its last review is deleted', () => {
    expect(applyRatingChange({ rating: 2, count: 1, distribution: { 2: 1 } }, 2, null)).toEqual({
      rating: 0,
      count: 0,
      distribution: { 2: 0 },
    });
  });
});
