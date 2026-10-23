export function RatingStars({ value }: { value: number }) {
  const rating = Math.max(0, Math.min(5, value));
  return <span className="rating-stars" role="img" aria-label={`${rating} trên 5 sao`}><span aria-hidden="true">★★★★★</span><span aria-hidden="true" style={{ width: `${rating * 20}%` }}>★★★★★</span></span>;
}
