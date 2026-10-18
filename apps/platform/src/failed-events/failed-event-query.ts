import { EVENT_DEAD_LETTER_STATUS, type EventDeadLetterStatus } from "@banijjik/contracts";
import {
  LIST_PAGE_SIZE,
  choiceParam,
  hrefWith,
  pageParam,
  type RawParams,
} from "../lists/list-query";

export const FAILED_EVENT_VIEWS = ["handlers", "outbox"] as const;
export type FailedEventView = (typeof FAILED_EVENT_VIEWS)[number];

export const FAILED_EVENTS_PATH = "/failed-events";

export interface FailedEventQuery {
  view: FailedEventView;
  /** Only for the handlers view. FAILED is what waits for an operator, so it is the default. */
  status: EventDeadLetterStatus;
  page: number;
}

/** The list state lives in the URL. Anything unreadable is ignored, never an error. */
export function parseFailedEventQuery(params: RawParams): FailedEventQuery {
  return {
    view: choiceParam(params["view"], FAILED_EVENT_VIEWS) ?? "handlers",
    status:
      choiceParam(params["status"], Object.values(EVENT_DEAD_LETTER_STATUS)) ??
      EVENT_DEAD_LETTER_STATUS.FAILED,
    page: pageParam(params["page"]),
  };
}

/** The page path with the given state; defaults (handlers, FAILED, page 1) leave no trace in the URL. */
export function failedEventsHref(query: FailedEventQuery): string {
  return hrefWith(FAILED_EVENTS_PATH, {
    view: query.view === "handlers" ? undefined : query.view,
    status:
      query.view === "handlers" && query.status !== EVENT_DEAD_LETTER_STATUS.FAILED
        ? query.status
        : undefined,
    page: query.page > 1 ? query.page : undefined,
  });
}

/** The API path of one page of the current view. */
export function failedEventsApiPath(query: FailedEventQuery): string {
  if (query.view === "outbox") {
    return hrefWith("/platform/dead-outbox-events", { page: query.page, limit: LIST_PAGE_SIZE });
  }
  return hrefWith("/platform/event-dead-letters", {
    page: query.page,
    limit: LIST_PAGE_SIZE,
    status: query.status,
  });
}
