import { EVENT_TYPE, MODULE_KEY, type EventEnvelope, type EventType } from "@banijjik/contracts";
import type { EventHandler } from "../../../../kernel/events/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import { reportSourceMissing } from "../domain/errors.js";
import {
  incrementOf,
  REPORT_HANDLED_EVENT_TYPES,
  REPORT_SUBJECT_KEY,
  type IncrementContext,
} from "./event-increments.js";
import type {
  DailySummaryWriter,
  OrganizationLocalSettings,
  ReportEventMarkerRepository,
  ReportSourceReader,
} from "./ports/report-ports.js";

export interface SummarizeHandlerDependencies {
  readonly reader: ReportSourceReader;
  readonly settings: OrganizationLocalSettings;
  readonly markers: ReportEventMarkerRepository;
  readonly summaries: DailySummaryWriter;
  readonly clock: Clock;
}

/**
 * Counts each sale, return, booking, enrollment, payment and expense into its daily summary row.
 * UNORDERED: every event carries the ids of its own fact, so no stream order is needed. Exactly once
 * (plan 3.10 decision 3): the marker is written first in the handler's transaction, and a repeat
 * finds it and counts nothing.
 */
export function buildSummarizeEventHandler(
  dependencies: SummarizeHandlerDependencies,
): EventHandler<typeof EVENT_TYPE.ORDER_COMPLETED> {
  return {
    handlerKey: "report.summarize",
    moduleKey: MODULE_KEY.REPORT,
    eventType: EVENT_TYPE.ORDER_COMPLETED,
    alsoHandles: REPORT_HANDLED_EVENT_TYPES,
    ordering: "UNORDERED",
    async handle(envelope) {
      await summarizeEvent(dependencies, envelope);
    },
  };
}

async function summarizeEvent(
  dependencies: SummarizeHandlerDependencies,
  envelope: EventEnvelope<unknown>,
): Promise<void> {
  if (envelope.organizationId === null) throw reportSourceMissing("organization");
  const organizationId = envelope.organizationId;
  const isNew = await dependencies.markers.recordIfNew({
    organizationId,
    eventId: envelope.eventId,
    appliedAt: dependencies.clock.now(),
  });
  if (!isNew) return;

  const context = await buildIncrementContext(dependencies, organizationId, envelope);
  const eventType = envelope.type as EventType;
  const pending = incrementOf(eventType, context);
  if (pending === undefined) return;
  await dependencies.summaries.applyIncrement({
    organizationId,
    currency: context.organizationCurrency,
    increment: await pending,
  });
}

async function buildIncrementContext(
  dependencies: SummarizeHandlerDependencies,
  organizationId: string,
  envelope: EventEnvelope<unknown>,
): Promise<IncrementContext> {
  const timeZone = await dependencies.settings.timeZoneOf(organizationId);
  if (timeZone === undefined) throw reportSourceMissing("organization.timeZone");
  const organizationCurrency = await dependencies.settings.currencyOf(organizationId);
  if (organizationCurrency === undefined) throw reportSourceMissing("organization.currency");
  return {
    subjectId: subjectIdOf(envelope),
    occurredAt: new Date(envelope.occurredAt),
    timeZone,
    organizationCurrency,
    reader: dependencies.reader,
  };
}

/** The id of the fact the event names, read from its payload (payloads carry ids only). */
function subjectIdOf(envelope: EventEnvelope<unknown>): string {
  const key = REPORT_SUBJECT_KEY[envelope.type];
  const payload: unknown = envelope.payload;
  const value =
    key === undefined || typeof payload !== "object" || payload === null
      ? undefined
      : Reflect.get(payload, key);
  if (typeof value !== "string") throw reportSourceMissing(`payload:${envelope.type}`);
  return value;
}
