import { MODULE_KEY, MODULE_OVERRIDE_EFFECT, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import type { ReportHomeResponse, ReportPeriodValues } from "@banijjik/contracts/report";
import { newId } from "@banijjik/ids";
import { expect } from "vitest";
import { systemClock } from "../kernel/time/index.js";
import { registerAccountingAndExpenseHandlers } from "../routes/accounting-event-handlers.js";
import { registerCommissionHandlers } from "../routes/commission-adapters.js";
import { buildModuleRegistry } from "../routes/module-registry.js";
import {
  buildOrganizationConfigPorts,
  buildResolvedConfigSources,
} from "../routes/organization-config-ports.js";
import { registerReportEventHandlers } from "../routes/report-event-handlers.js";
import { buildOrgConfigService } from "../modules/platform/entitlement/index.js";
import { buildIndustryTemplateReader } from "../modules/platform/industry/index.js";
import { money, startCatalogApi } from "./catalog-world.js";
import { type IamApiHarness } from "./iam-api-harness.js";
import { writeModuleOverride } from "./entitlement-world.js";
import { processOrganizationOutbox } from "./outbox-replay.js";
import { addMemberWithAssignments, findSystemRoleId, type AddedMember } from "./rbac-world.js";
import { type SalesShop } from "./sales-api-world.js";
import type { ApiActor, TwoOrganizations } from "./two-organizations.js";
import type { PosTill } from "./pos-api-world.js";
import { tillCall } from "./pos-api-world.js";

const ORGANIZATION_TIME_ZONE = "Asia/Dhaka";
const TRIAL_BALANCE_DATE = "2099-12-31";
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const BASIS_POINTS = 10_000;
const HTTP_OK = 200;

export interface ExclusiveTaxQuote {
  readonly discount: number;
  readonly afterDiscount: number;
  readonly tax: number;
  readonly grand: number;
}

/** Integer exclusive-tax quote of one list price (same floor as the pricing engine). */
export function exclusiveTaxOf(
  list: number,
  promotionBps: number,
  taxBps: number,
): ExclusiveTaxQuote {
  const discount = Math.floor((list * promotionBps) / BASIS_POINTS);
  const afterDiscount = list - discount;
  const tax = Math.floor((afterDiscount * taxBps) / BASIS_POINTS);
  return { discount, afterDiscount, tax, grand: afterDiscount + tax };
}

export function percentOf(base: number, basisPoints: number): number {
  return Math.floor((base * basisPoints) / BASIS_POINTS);
}

export function todayInDhaka(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ORGANIZATION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Seven ISO weekdays, all day, so a slot an hour from now is always inside opening hours. */
export const EVERY_DAY_SCHEDULE = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
  weekday,
  opensAt: "00:00",
  closesAt: "23:59",
}));

/** A 5-minute bucket at least an hour ahead; after 22:00 Dhaka it is tomorrow 10:00. */
export function aBookableInstant(): string {
  const soon = new Date(Math.ceil((Date.now() + ONE_HOUR_MS) / FIVE_MINUTES_MS) * FIVE_MINUTES_MS);
  const hourInDhaka = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: ORGANIZATION_TIME_ZONE,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(soon),
  );
  if (hourInDhaka < 22) return soon.toISOString();
  const [year, month, date] = todayInDhaka().split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (date ?? 1) + 1, 4, 0, 0)).toISOString();
}

export async function startDayScenarioApi(): Promise<IamApiHarness> {
  const harness = await startCatalogApi();
  registerAccountingAndExpenseHandlers();
  const registry = buildModuleRegistry();
  const orgConfig = buildOrgConfigService({
    registry,
    clock: systemClock,
    ...buildOrganizationConfigPorts(),
    ...buildResolvedConfigSources(registry),
    templates: buildIndustryTemplateReader(systemClock),
  });
  registerCommissionHandlers(systemClock, orgConfig);
  registerReportEventHandlers(systemClock);
  return harness;
}

export async function processDayAndReplay(organizationId: string): Promise<void> {
  await processOrganizationOutbox(organizationId);
  await processOrganizationOutbox(organizationId);
}

export async function grantCommission(organizationId: string): Promise<void> {
  await writeModuleOverride({
    organizationId,
    moduleKey: MODULE_KEY.COMMISSION,
    effect: MODULE_OVERRIDE_EFFECT.PLATFORM_GRANT,
  });
}

export async function homeOf(actor: ApiActor, organizationId: string): Promise<ReportHomeResponse> {
  const response = await actor.call("get", `/orgs/${organizationId}/reports/home`);
  expect(response.status, JSON.stringify(response.body)).toBe(HTTP_OK);
  return response.body.data as ReportHomeResponse;
}

export async function dailyTodayOf(
  actor: ApiActor,
  organizationId: string,
  today: string,
): Promise<ReportPeriodValues> {
  const response = await actor.call(
    "get",
    `/orgs/${organizationId}/reports/daily?from=${today}&to=${today}&limit=100`,
  );
  expect(response.status, JSON.stringify(response.body)).toBe(HTTP_OK);
  return (response.body.data as { totals: ReportPeriodValues }).totals;
}

export async function trialBalances(actor: ApiActor, organizationId: string): Promise<boolean> {
  const response = await actor.call(
    "get",
    `/orgs/${organizationId}/accounting/trial-balance?asOf=${TRIAL_BALANCE_DATE}`,
  );
  expect(response.status, JSON.stringify(response.body)).toBe(HTTP_OK);
  return (response.body.data as { balances: boolean }).balances;
}

export async function commissionSummaryOf(
  actor: ApiActor,
  organizationId: string,
): Promise<readonly { memberId: string; open: { amount: number } }[]> {
  const response = await actor.call("get", `/orgs/${organizationId}/commission/summary`);
  if (response.status === 403 && response.body.error?.code === "MODULE_DISABLED") return [];
  expect(response.status, JSON.stringify(response.body)).toBe(HTTP_OK);
  return response.body.data as { memberId: string; open: { amount: number } }[];
}

export async function zReportOf(till: PosTill, posSessionId: string): Promise<unknown> {
  const response = await tillCall(till, {
    method: "get",
    suffix: `/sessions/${posSessionId}/z-report`,
  });
  expect(response.status, JSON.stringify(response.body)).toBe(HTTP_OK);
  return response.body.data;
}

export interface DayOutcome {
  readonly homeToday: ReportPeriodValues;
  readonly dailyTotals: ReportPeriodValues;
  readonly trialBalances: boolean;
  readonly commission: readonly { memberId: string; open: { amount: number } }[];
  readonly zReport: unknown;
}

export interface DayRead {
  readonly actor: ApiActor;
  readonly organizationId: string;
  readonly today: string;
  readonly tillSession?: { readonly till: PosTill; readonly posSessionId: string };
}

export async function dayOutcomeOf(read: DayRead): Promise<DayOutcome> {
  return {
    homeToday: (await homeOf(read.actor, read.organizationId)).periods.today,
    dailyTotals: await dailyTodayOf(read.actor, read.organizationId, read.today),
    trialBalances: await trialBalances(read.actor, read.organizationId),
    commission: await commissionSummaryOf(read.actor, read.organizationId),
    zReport:
      read.tillSession === undefined
        ? null
        : await zReportOf(read.tillSession.till, read.tillSession.posSessionId),
  };
}

export async function replayLeavesOutcomeUnchanged(read: DayRead): Promise<DayOutcome> {
  await processOrganizationOutbox(read.organizationId);
  const first = await dayOutcomeOf(read);
  await processOrganizationOutbox(read.organizationId);
  expect(await dayOutcomeOf(read)).toEqual(first);
  return first;
}

export async function payCash(
  shop: SalesShop,
  input: { readonly requestType: string; readonly requestId: string; readonly amount: number },
): Promise<void> {
  const response = await shop.actor.callWith({
    method: "post",
    path: `/orgs/${shop.organizationId}/payments`,
    idempotencyKey: newId(),
    body: {
      locationId: shop.locationId,
      method: "CASH",
      amount: money(input.amount),
      allocations: [
        {
          requestType: input.requestType,
          requestId: input.requestId,
          amount: money(input.amount),
        },
      ],
    },
  });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
}

export async function performerMemberIdOf(shop: SalesShop): Promise<string> {
  const people = await shop.actor.call(
    "get",
    `/orgs/${shop.organizationId}/sales/performers?locationId=${shop.locationId}`,
  );
  expect(people.status).toBe(HTTP_OK);
  const memberId = (people.body.data as { memberId: string }[])[0]?.memberId;
  if (memberId === undefined) throw new Error("expected a performer");
  return memberId;
}

export async function cashierOf(
  harness: IamApiHarness,
  world: TwoOrganizations,
): Promise<AddedMember> {
  const roleId = await findSystemRoleId(
    harness.connections,
    world.organizationA,
    SYSTEM_ROLE_KEY.CASHIER,
  );
  return addMemberWithAssignments(harness.app, world.organizationA, [
    { locationId: world.locationA1, roleId },
  ]);
}
