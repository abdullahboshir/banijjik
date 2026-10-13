import { USER_STATUS } from "@banijjik/contracts";
import {
  LIST_PAGE_SIZE,
  choiceParam,
  hrefWith,
  pageParam,
  type RawParams,
} from "../lists/list-query";
import type { OperatorListStatus } from "./operator-action-rules";

export const OPERATOR_FILTER_STATUSES: readonly OperatorListStatus[] = [
  USER_STATUS.ACTIVE,
  USER_STATUS.DISABLED,
];

export interface OperatorQuery {
  status: OperatorListStatus | undefined;
  page: number;
}

/** The list state lives in the URL. Anything unreadable is ignored, never an error. */
export function parseOperatorQuery(params: RawParams): OperatorQuery {
  return {
    status: choiceParam(params["status"], OPERATOR_FILTER_STATUSES),
    page: pageParam(params["page"]),
  };
}

export const OPERATORS_PATH = "/operators";

/** The list path with the given state; defaults (page 1, no filter) leave no trace in the URL. */
export function operatorListHref(query: OperatorQuery): string {
  return hrefWith(OPERATORS_PATH, {
    status: query.status,
    page: query.page > 1 ? query.page : undefined,
  });
}

/** The API path of one page of operators. */
export function operatorsApiPath(query: OperatorQuery): string {
  return hrefWith("/platform/operators", {
    page: query.page,
    limit: LIST_PAGE_SIZE,
    status: query.status,
  });
}
