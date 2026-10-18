import { describe, expect, it } from "vitest";
import { failedEventsApiPath, failedEventsHref, parseFailedEventQuery } from "./failed-event-query";

describe("parseFailedEventQuery", () => {
  it("defaults to the failed handlers, page 1", () => {
    expect(parseFailedEventQuery({})).toEqual({ view: "handlers", status: "FAILED", page: 1 });
  });

  it("reads the view, the status and the page, and ignores anything unreadable", () => {
    expect(parseFailedEventQuery({ view: "outbox", status: "SKIPPED", page: "3" })).toEqual({
      view: "outbox",
      status: "SKIPPED",
      page: 3,
    });
    expect(parseFailedEventQuery({ view: "nope", status: "x", page: "-4" })).toEqual({
      view: "handlers",
      status: "FAILED",
      page: 1,
    });
  });
});

describe("failedEventsHref", () => {
  it("leaves no trace of the defaults in the URL", () => {
    expect(failedEventsHref({ view: "handlers", status: "FAILED", page: 1 })).toBe(
      "/failed-events",
    );
  });

  it("keeps the view, the status and the page when they differ", () => {
    expect(failedEventsHref({ view: "outbox", status: "FAILED", page: 2 })).toBe(
      "/failed-events?view=outbox&page=2",
    );
    expect(failedEventsHref({ view: "handlers", status: "REPLAYED", page: 1 })).toBe(
      "/failed-events?status=REPLAYED",
    );
  });
});

describe("failedEventsApiPath", () => {
  it("asks the dead-letter list with the status, and the outbox list without one", () => {
    expect(failedEventsApiPath({ view: "handlers", status: "FAILED", page: 2 })).toBe(
      "/platform/event-dead-letters?page=2&limit=20&status=FAILED",
    );
    expect(failedEventsApiPath({ view: "outbox", status: "FAILED", page: 1 })).toBe(
      "/platform/dead-outbox-events?page=1&limit=20",
    );
  });
});
