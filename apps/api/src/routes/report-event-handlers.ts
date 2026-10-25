import { buildReportEventHandler } from "../modules/commerce/report/index.js";
import { registerEventHandler } from "../kernel/events/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildReportOrganizationSettings, buildReportSourceReader } from "./report-sources.js";

/** Registers the report's summarize handler for the worker role (plan 3.10 decision 3). */
export function registerReportEventHandlers(clock: Clock): void {
  registerEventHandler(
    buildReportEventHandler({
      reader: buildReportSourceReader(),
      settings: buildReportOrganizationSettings(),
      clock,
    }),
  );
}
