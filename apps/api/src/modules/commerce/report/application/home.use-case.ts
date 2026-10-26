import { MODULE_KEY, type ModuleKey } from "@banijjik/contracts";
import {
  REPORT_SECTION,
  type ReportHomeResponse,
  type ReportSection,
} from "@banijjik/contracts/report";
import type { Clock } from "../../../../kernel/time/index.js";
import type { OrgConfigService } from "../../../platform/entitlement/index.js";
import {
  businessDateOf,
  businessDatesBetween,
  monthStartOf,
  shiftBusinessDate,
} from "../domain/business-date.js";
import { reportSourceMissing } from "../domain/errors.js";
import { periodOf, rowsByDay } from "./report-periods.js";
import type { DailySummaryReader, OrganizationLocalSettings } from "./ports/report-ports.js";

export interface HomeDependencies {
  readonly rows: DailySummaryReader;
  readonly settings: OrganizationLocalSettings;
  readonly orgConfig: Pick<OrgConfigService, "isModuleEffective">;
  readonly clock: Clock;
}

export interface HomeInput {
  readonly organizationId: string;
  /** Present for `?location=`; absent means every location the caller may see (the tenancy plugin narrows it). */
  readonly locationId?: string | undefined;
}

/** Which source module feeds each home section (plan 3.10 decision 8). MONEY has two sources. */
const SECTION_SOURCES: Readonly<Record<ReportSection, readonly ModuleKey[]>> = {
  [REPORT_SECTION.SALES]: [MODULE_KEY.SALES],
  [REPORT_SECTION.BOOKINGS]: [MODULE_KEY.BOOKING],
  [REPORT_SECTION.ENROLLMENTS]: [MODULE_KEY.ENROLLMENT],
  [REPORT_SECTION.MONEY]: [MODULE_KEY.PAYMENT, MODULE_KEY.EXPENSE],
};

/** Today, yesterday and month to date, from the pre-aggregated daily rows only (never a source scan). */
export class HomeReportUseCase {
  constructor(private readonly dependencies: HomeDependencies) {}

  async execute(input: HomeInput): Promise<ReportHomeResponse> {
    const { organizationId, locationId } = input;
    const timeZone = await this.dependencies.settings.timeZoneOf(organizationId);
    if (timeZone === undefined) throw reportSourceMissing("organization.timeZone");
    const currency = await this.dependencies.settings.currencyOf(organizationId);
    if (currency === undefined) throw reportSourceMissing("organization.currency");

    const today = businessDateOf(this.dependencies.clock.now(), timeZone);
    const yesterday = shiftBusinessDate(today, -1);
    const monthDays = businessDatesBetween(monthStartOf(today), today);
    const rows = await this.dependencies.rows.listRows({
      organizationId,
      businessDates: [yesterday, ...monthDays],
      locationId,
    });
    const byDay = rowsByDay(rows);

    return {
      businessDate: today,
      yesterdayDate: yesterday,
      currency,
      sections: await this.effectiveSections(organizationId),
      periods: {
        today: periodOf(byDay.get(today) ?? []),
        yesterday: periodOf(byDay.get(yesterday) ?? []),
        monthToDate: periodOf(rows.filter((row) => monthDays.includes(row.businessDate))),
      },
    };
  }

  /** A section is shown while one of its source modules is effective for the organization. */
  private async effectiveSections(organizationId: string): Promise<readonly ReportSection[]> {
    const shown: ReportSection[] = [];
    for (const section of Object.values(REPORT_SECTION)) {
      if (await this.isAnySourceEffective(organizationId, SECTION_SOURCES[section])) {
        shown.push(section);
      }
    }
    return shown;
  }

  private async isAnySourceEffective(
    organizationId: string,
    moduleKeys: readonly ModuleKey[],
  ): Promise<boolean> {
    for (const moduleKey of moduleKeys) {
      if (await this.dependencies.orgConfig.isModuleEffective(organizationId, moduleKey)) {
        return true;
      }
    }
    return false;
  }
}
