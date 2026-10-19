export const EXPENSE_PAGE_SIZE = 20;

export interface ExpenseQuery {
  from: string | undefined;
  to: string | undefined;
  expenseCategoryId: string | undefined;
  locationId: string | undefined;
  page: number;
}

type RawParam = string | string[] | undefined;

function firstOf(value: RawParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isoDateOf(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : undefined;
}

/** The list state lives in the URL. Unreadable values are ignored. */
export function parseExpenseQuery(params: Record<string, RawParam>): ExpenseQuery {
  const page = Number(firstOf(params["page"]));
  return {
    from: isoDateOf(firstOf(params["from"])),
    to: isoDateOf(firstOf(params["to"])),
    expenseCategoryId: firstOf(params["expenseCategoryId"]),
    locationId: firstOf(params["locationId"]),
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

export function expenseListHref(basePath: string, query: ExpenseQuery): string {
  const params = new URLSearchParams();
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.expenseCategoryId) params.set("expenseCategoryId", query.expenseCategoryId);
  if (query.locationId) params.set("locationId", query.locationId);
  if (query.page > 1) params.set("page", String(query.page));
  const text = params.toString();
  return text === "" ? basePath : `${basePath}?${text}`;
}

export function expensesApiPath(organizationId: string, query: ExpenseQuery): string {
  const params = new URLSearchParams({
    page: String(query.page),
    limit: String(EXPENSE_PAGE_SIZE),
  });
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.expenseCategoryId) params.set("expenseCategoryId", query.expenseCategoryId);
  if (query.locationId) params.set("locationId", query.locationId);
  return `/orgs/${organizationId}/expenses?${params.toString()}`;
}
