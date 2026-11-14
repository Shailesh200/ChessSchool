/** Spaced review for practice: a missed position comes back after 1, 3 and 7 days until solved cleanly. */
export type ReviewCard = { due: string; box: number };
export type Review = Record<string, ReviewCard>;

const GAPS = [1, 3, 7];
export const REVIEW_MAX = 200;

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** After answering `ref` today: a miss (re)starts the schedule; a clean answer moves a card on, and retires it after the last gap. */
export function reviewAfter(review: Review, ref: string, missed: boolean, today: string): Review {
  const card = review[ref];
  if (missed) return trim({ ...review, [ref]: { due: addDays(today, GAPS[0]), box: 0 } });
  if (!card || card.due > today) return review;
  const next = { ...review };
  if (card.box + 1 >= GAPS.length) delete next[ref];
  else next[ref] = { due: addDays(today, GAPS[card.box + 1]), box: card.box + 1 };
  return next;
}

/** Refs due today or earlier, most overdue first. */
export const dueReviews = (review: Review, today: string, max = 5) =>
  Object.entries(review)
    .filter(([, c]) => c.due <= today)
    .sort((a, b) => a[1].due.localeCompare(b[1].due))
    .slice(0, max)
    .map(([ref]) => ref);

/** Keeps the soonest cards when the list grows past REVIEW_MAX. */
function trim(review: Review): Review {
  const entries = Object.entries(review);
  if (entries.length <= REVIEW_MAX) return review;
  return Object.fromEntries(entries.sort((a, b) => a[1].due.localeCompare(b[1].due)).slice(0, REVIEW_MAX));
}

export function isReview(v: unknown): v is Review {
  return Boolean(v && typeof v === "object" && Object.values(v as object).every((c) => c && typeof c.due === "string" && typeof c.box === "number"));
}

/** Practice serves 5 positions and keeps 5 more for offline use. */
export const PRACTICE_SET = 5;

/** The body for POST /v1/practice: every finished lesson plus today's due reviews. */
export const practiceRequest = (completed: Record<string, string>, review: Review, today: string) => ({
  lessons: Object.keys(completed),
  review: dueReviews(review, today, PRACTICE_SET),
  count: PRACTICE_SET * 2,
});
