export interface RateLimitRequest {
  /** What is limited, e.g. "auth.login.ip". */
  readonly bucket: string;
  /** Who is limited: an IP address, an identifier. Stored only as a hash. */
  readonly key: string;
  readonly limit: number;
  readonly windowSeconds: number;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  /** Seconds until the current window ends; meaningful when `allowed` is false. */
  readonly retryAfterSeconds: number;
}

export interface RateLimitSubject {
  readonly bucket: string;
  readonly key: string;
}

/**
 * Port of the kernel. A call to `consume` counts one attempt; the attempt is refused once the
 * count in the current window passes `limit`. Card 1.4 may swap the Mongo implementation for Redis.
 */
export interface RateLimiter {
  consume(request: RateLimitRequest): Promise<RateLimitDecision>;
  /** Forgets the counters of one subject, e.g. after a successful login. */
  reset(subject: RateLimitSubject): Promise<void>;
}
