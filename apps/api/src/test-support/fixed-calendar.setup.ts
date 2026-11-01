import { vi } from "vitest";

/**
 * The day the whole API suite last passed against the real calendar. Test data written since then
 * (fixed business dates, sessions "next month") is relative to it, so every run starts here.
 */
const SUITE_CALENDAR_START = new Date("2026-10-31T08:00:00.000Z");

// Only Date is faked and it keeps ticking at real speed, so timeouts, waits and the system clock used by
// event handlers behave as before; the test MongoDB runs without its TTL monitor for the same reason.
vi.useFakeTimers({ now: SUITE_CALENDAR_START, toFake: ["Date"], shouldAdvanceTime: true });
