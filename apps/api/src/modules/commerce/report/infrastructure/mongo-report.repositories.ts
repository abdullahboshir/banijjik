import { REPORT_COUNTER, type ReportCounters } from "@banijjik/contracts/report";
import { newId } from "@banijjik/ids";
import type { Model } from "mongoose";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { SummaryIncrement } from "../domain/summary-increment.js";
import type {
  DailySummaryReader,
  DailySummaryRow,
  DailySummaryWriter,
  ReportEventMarkerRepository,
} from "../application/ports/report-ports.js";
import {
  DAILY_SUMMARY_MODEL_NAME,
  REPORT_EVENT_APPLIED_MODEL_NAME,
  type DailySummaryDocument,
  type ReportEventAppliedDocument,
} from "./report.schema.js";

function dailySummaryModel(): Model<DailySummaryDocument> {
  return models({}).get<DailySummaryDocument>(DAILY_SUMMARY_MODEL_NAME);
}

function markerModel(): Model<ReportEventAppliedDocument> {
  return models({}).get<ReportEventAppliedDocument>(REPORT_EVENT_APPLIED_MODEL_NAME);
}

/** The fields the home and the reports read: nothing else of a row leaves the store. */
const ROW_PROJECTION = Object.fromEntries([
  ["locationId", 1],
  ["businessDate", 1],
  ["paidInByMethod", 1],
  ["refundedByMethod", 1],
  ["reversedByMethod", 1],
  ...Object.values(REPORT_COUNTER).map((counter) => [counter, 1]),
]);

/**
 * The `$inc` of one increment. A method delta uses a dotted path, so one method's total grows on
 * its own key. The version moves with every change (optimistic concurrency, ADR-036).
 */
function incrementOperators(increment: SummaryIncrement): Record<string, number> {
  const operators: Record<string, number> = { version: 1 };
  for (const [counter, delta] of Object.entries(increment.counterDeltas)) {
    if (delta !== undefined) operators[counter] = delta;
  }
  if (increment.methodDelta !== undefined) {
    const { field, method, amount } = increment.methodDelta;
    operators[`${field}.${method}`] = amount;
  }
  return operators;
}

function countersOf(row: DailySummaryDocument): ReportCounters {
  const counters = {} as Record<string, number>;
  for (const counter of Object.values(REPORT_COUNTER)) counters[counter] = row[counter] ?? 0;
  return counters as ReportCounters;
}

function toRow(row: DailySummaryDocument): DailySummaryRow {
  return {
    locationId: row.locationId,
    businessDate: row.businessDate,
    counters: countersOf(row),
    paidInByMethod: row.paidInByMethod ?? {},
    refundedByMethod: row.refundedByMethod ?? {},
    reversedByMethod: row.reversedByMethod ?? {},
  };
}

export class MongoReportEventMarkerRepository implements ReportEventMarkerRepository {
  async recordIfNew(input: {
    readonly organizationId: string;
    readonly eventId: string;
    readonly appliedAt: Date;
  }): Promise<boolean> {
    // An upsert, not an insert: a duplicate-key error would abort the transaction that also holds the
    // counters (the same reason the kernel's processed-event marker is an upsert).
    const result = await markerModel().updateOne(
      { organizationId: input.organizationId, eventId: input.eventId },
      {
        $setOnInsert: {
          reportEventAppliedId: newId(),
          appliedAt: input.appliedAt,
          createdByUserId: null,
          updatedByUserId: null,
        },
      },
      { upsert: true, setDefaultsOnInsert: false, ...sessionOption(getActiveSession()) },
    );
    return result.upsertedCount > 0;
  }
}

export class MongoDailySummaryRepository implements DailySummaryWriter, DailySummaryReader {
  async applyIncrement(input: {
    readonly organizationId: string;
    readonly currency: string;
    readonly increment: SummaryIncrement;
  }): Promise<void> {
    const { organizationId, currency, increment } = input;
    // The filter's equality fields are copied into a new row, so only the other fields are set here.
    await dailySummaryModel().updateOne(
      { organizationId, locationId: increment.locationId, businessDate: increment.businessDate },
      {
        $inc: incrementOperators(increment),
        $setOnInsert: {
          dailySummaryId: newId(),
          currency,
          createdByUserId: null,
          updatedByUserId: null,
        },
      },
      { upsert: true, setDefaultsOnInsert: false, ...sessionOption(getActiveSession()) },
    );
  }

  async listRows(input: {
    readonly organizationId: string;
    readonly businessDates: readonly string[];
    readonly locationId?: string | undefined;
  }): Promise<readonly DailySummaryRow[]> {
    const filter = {
      organizationId: input.organizationId,
      businessDate: { $in: [...input.businessDates] },
      ...(input.locationId === undefined ? {} : { locationId: input.locationId }),
    };
    const rows = await dailySummaryModel()
      .find(filter)
      .select(ROW_PROJECTION)
      .lean<DailySummaryDocument[]>();
    return rows.map(toRow);
  }
}
