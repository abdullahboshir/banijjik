import type { Labels } from "../lib/labels";

/** Text of the failed-events list, its buttons and its sheets (one translated string per key). */
export const FAILED_EVENT_LABEL_KEYS = [
  "platform.failedEvents.handlers.empty",
  "platform.failedEvents.outbox.empty",
  "platform.failedEvents.column.event",
  "platform.failedEvents.column.organization",
  "platform.failedEvents.column.handler",
  "platform.failedEvents.column.error",
  "platform.failedEvents.column.attempts",
  "platform.failedEvents.column.when",
  "platform.failedEvents.column.status",
  "platform.failedEvents.column.actions",
  "platform.failedEvents.waiting",
  "platform.failedEvents.noOrganization",
  "platform.failedEvents.status.FAILED",
  "platform.failedEvents.status.REPLAY_REQUESTED",
  "platform.failedEvents.status.REPLAYED",
  "platform.failedEvents.status.SKIPPED",
  "platform.failedEvents.action.replay",
  "platform.failedEvents.action.skip",
  "platform.failedEvents.sheet.replay.title",
  "platform.failedEvents.sheet.replay.description",
  "platform.failedEvents.sheet.replay.success",
  "platform.failedEvents.sheet.skip.title",
  "platform.failedEvents.sheet.skip.description",
  "platform.failedEvents.sheet.skip.success",
  "platform.failedEvents.sheet.outbox.title",
  "platform.failedEvents.sheet.outbox.description",
  "platform.failedEvents.sheet.outbox.success",
  "platform.failedEvents.field.skipReason",
  "platform.failedEvents.field.skipReasonHint",
  "platform.field.reason",
] as const;

export type FailedEventLabels = Labels<(typeof FAILED_EVENT_LABEL_KEYS)[number]>;
