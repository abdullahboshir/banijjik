import { vi } from "vitest";

/**
 * The day the whole API suite last passed against the real calendar. Test data written since then
 * (fixed business dates, sessions "next month") is relative to it, so every test file starts here.
 */
const SUITE_CALENDAR_START_MS = Date.parse("2026-10-31T08:00:00.000Z");

const RealDate = Date;
// Fixed when the file loads. From then on Date moves at real speed in real millisecond steps, so events
// keep distinct, ordered times (fake timers tick in coarse steps and made ordered streams tie).
const CALENDAR_OFFSET_MS = SUITE_CALENDAR_START_MS - RealDate.now();

function suiteNow(): number {
  return RealDate.now() + CALENDAR_OFFSET_MS;
}

type DateArguments =
  [] | [value: string | number | Date] | [year: number, monthIndex: number, ...rest: number[]];

/** A Date whose "now" is the suite calendar; every other constructor form and method is the real one. */
class SuiteCalendarDate extends RealDate {
  constructor(...args: DateArguments) {
    if (args.length === 0) {
      super(suiteNow());
      return;
    }
    // The real constructor takes every other form as given; the tuple type only satisfies its overloads.
    super(...(args as [number, number]));
  }

  static override now(): number {
    return suiteNow();
  }

  // Dates made before the swap, or by code holding the original constructor, are still Dates.
  static override [Symbol.hasInstance](value: unknown): boolean {
    return value instanceof RealDate;
  }
}

// Mongoose resolves `type: Date` in schemas by the constructor's name.
Object.defineProperty(SuiteCalendarDate, "name", { value: "Date" });
vi.stubGlobal("Date", SuiteCalendarDate);
