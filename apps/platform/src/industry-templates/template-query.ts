import { INDUSTRY_TEMPLATE_STATUS, type IndustryTemplateStatus } from "@banijjik/contracts";
import {
  LIST_PAGE_SIZE,
  choiceParam,
  hrefWith,
  pageParam,
  type RawParams,
} from "../lists/list-query";

export const INDUSTRY_TEMPLATE_FILTERS: readonly IndustryTemplateStatus[] = [
  INDUSTRY_TEMPLATE_STATUS.DRAFT,
  INDUSTRY_TEMPLATE_STATUS.PUBLISHED,
  INDUSTRY_TEMPLATE_STATUS.RETIRED,
];

export interface IndustryTemplateQuery {
  status: IndustryTemplateStatus | undefined;
  page: number;
}

export const INDUSTRY_TEMPLATES_PATH = "/industry-templates";

/** The list state lives in the URL. Anything unreadable is ignored. */
export function parseIndustryTemplateQuery(params: RawParams): IndustryTemplateQuery {
  return {
    status: choiceParam(params["status"], INDUSTRY_TEMPLATE_FILTERS),
    page: pageParam(params["page"]),
  };
}

export function industryTemplateListHref(query: IndustryTemplateQuery): string {
  return hrefWith(INDUSTRY_TEMPLATES_PATH, {
    status: query.status,
    page: query.page > 1 ? query.page : undefined,
  });
}

export function industryTemplatesApiPath(query: IndustryTemplateQuery): string {
  return hrefWith("/platform/industry-templates", {
    page: query.page,
    limit: LIST_PAGE_SIZE,
    status: query.status,
  });
}
