export type RatingState = {
  rating: number;
  count: number;
  distribution: Record<string, number>;
};

export function applyRatingChange(
  state: RatingState,
  previousRating: number | null,
  nextRating: number | null,
): RatingState {
  const count = state.count + (previousRating === null ? 1 : 0) - (nextRating === null ? 1 : 0);
  const total = state.rating * state.count - (previousRating ?? 0) + (nextRating ?? 0);
  const distribution = { ...state.distribution };
  if (previousRating !== null) distribution[previousRating] = Math.max(0, (distribution[previousRating] ?? 0) - 1);
  if (nextRating !== null) distribution[nextRating] = (distribution[nextRating] ?? 0) + 1;
  return { rating: count ? Math.round((total / count) * 10) / 10 : 0, count, distribution };
}
