import { BOOKING_BUCKET_MINUTES } from "@banijjik/contracts/booking";

const BUCKET_MS = BOOKING_BUCKET_MINUTES * 60_000;

/** Aligns a UTC instant down to the start of its 5-minute bucket. */
export function alignBucketStart(instant: Date): Date {
  const ms = instant.getTime();
  return new Date(ms - (ms % BUCKET_MS));
}

/**
 * Every 5-minute bucket start covered by [startsAt, endsAt). The end instant itself is exclusive,
 * so a booking ending on a bucket boundary does not consume that next bucket.
 */
export function bucketStartsCovering(startsAt: Date, endsAt: Date): Date[] {
  if (!(endsAt.getTime() > startsAt.getTime())) return [];
  const first = alignBucketStart(startsAt);
  const lastExclusive = endsAt.getTime();
  const buckets: Date[] = [];
  for (let cursor = first.getTime(); cursor < lastExclusive; cursor += BUCKET_MS) {
    buckets.push(new Date(cursor));
  }
  return buckets;
}
