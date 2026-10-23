import {
  ACCEPTED_PAYMENT_METHODS,
  PAYMENT_DIRECTION,
  type PaymentDirection,
  type PaymentMethod,
} from "@banijjik/contracts/payment";

export const PAYMENT_PAGE_LIMIT = 50;

const ACCEPTED_METHODS = new Set<string>(ACCEPTED_PAYMENT_METHODS);
const DIRECTIONS = new Set<string>(Object.values(PAYMENT_DIRECTION));

type SearchParams = Record<string, string | string[] | undefined>;

export interface PaymentsQuery {
  readonly page: number;
  readonly limit: number;
  readonly method?: PaymentMethod | undefined;
  readonly direction?: PaymentDirection | undefined;
  readonly locationId?: string | undefined;
  readonly from?: string | undefined;
  readonly to?: string | undefined;
}

function firstString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function methodOf(searchParams: SearchParams): PaymentMethod | undefined {
  const raw = firstString(searchParams["method"]);
  if (raw && ACCEPTED_METHODS.has(raw)) return raw as PaymentMethod;
  return undefined;
}

function directionOf(searchParams: SearchParams): PaymentDirection | undefined {
  const raw = firstString(searchParams["direction"]);
  if (raw && DIRECTIONS.has(raw)) return raw as PaymentDirection;
  return undefined;
}

function pageOf(searchParams: SearchParams): number {
  const page = Number(firstString(searchParams["page"]) ?? "1");
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

function cleanString(value: string | string[] | undefined): string | undefined {
  const str = firstString(value)?.trim();
  return str && str.length > 0 ? str : undefined;
}

export function parsePaymentsQuery(searchParams: SearchParams): PaymentsQuery {
  return {
    page: pageOf(searchParams),
    limit: PAYMENT_PAGE_LIMIT,
    method: methodOf(searchParams),
    direction: directionOf(searchParams),
    locationId: cleanString(searchParams["locationId"]),
    from: cleanString(searchParams["from"]),
    to: cleanString(searchParams["to"]),
  };
}

export function paymentsApiQuery(query: PaymentsQuery): string {
  const params = new URLSearchParams({
    page: String(query.page),
    limit: String(query.limit),
  });
  if (query.method) params.set("method", query.method);
  if (query.direction) params.set("direction", query.direction);
  if (query.locationId) params.set("locationId", query.locationId);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  return params.toString();
}
