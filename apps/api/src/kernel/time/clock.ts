/** The current time as a dependency, so tests can move it (token expiry, rate-limit windows). */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };
