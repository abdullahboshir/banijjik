import type { Clock } from "../kernel/time/index.js";

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_DAY = 24 * 60 * 60;

/** A clock the test can move. It starts at a fixed morning so failures are reproducible. */
export class MutableClock implements Clock {
  constructor(private current: Date = new Date("2026-10-11T08:00:00.000Z")) {}

  now(): Date {
    return new Date(this.current);
  }

  advanceSeconds(seconds: number): void {
    this.current = new Date(this.current.getTime() + seconds * MILLISECONDS_PER_SECOND);
  }

  advanceDays(days: number): void {
    this.advanceSeconds(days * SECONDS_PER_DAY);
  }
}
