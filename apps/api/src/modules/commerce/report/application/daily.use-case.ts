import type { ReportDailyResponse, ReportDayRow } from "@banijjik/contracts/report";
import { businessDatesBetween } from "../domain/business-date.js";
import { reportSourceMissing } from "../domain/errors.js";
import { periodOf, rowsByDay } from "./report-periods.js";
import type { DailySummaryReader, OrganizationLocalSettings } from "./ports/report-ports.js";

export interface DailyDependencies {
  readonly rows: DailySummaryReader;
  readonly settings: OrganizationLocalSettings;
}

export interface DailyInput {
  readonly organizationId: string;
  readonly from: string;
  readonly to: string;
  readonly locationId?: string | undefined;
  readonly page: number;
  readonly limit: number;
}

/**
 * One item per day, newest first, over the rows of every location the caller may see (or one). The
 * range is validated at the edge (at most 92 days); the totals cover the whole range, not the page.
 */
export class DailyReportUseCase {
  constructor(private readonly dependencies: DailyDependencies) {}

  async execute(input: DailyInput): Promise<ReportDailyResponse> {
    const currency = await this.dependencies.settings.currencyOf(input.organizationId);
    if (currency === undefined) throw reportSourceMissing("organization.currency");
    const days = businessDatesBetween(input.from, input.to);
    const rows = await this.dependencies.rows.listRows({
      organizationId: input.organizationId,
      businessDates: days,
      locationId: input.locationId,
    });
    const byDay = rowsByDay(rows);
    const newestFirst = [...days].reverse();
    const pageStart = (input.page - 1) * input.limit;
    const pageDays = newestFirst.slice(pageStart, pageStart + input.limit);
    const items: ReportDayRow[] = pageDays.map((businessDate) => ({
      businessDate,
      values: periodOf(byDay.get(businessDate) ?? []),
    }));
    return {
      currency,
      from: input.from,
      to: input.to,
      items,
      totals: periodOf(rows),
      page: input.page,
      limit: input.limit,
      total: days.length,
    };
  }
}
