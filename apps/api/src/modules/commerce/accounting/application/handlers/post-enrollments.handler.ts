import {
  ENROLLMENT_EVENT_TYPE,
  type PeriodRevenueClosedPayload,
} from "@banijjik/contracts/enrollment";
import { MODULE_KEY, type EventEnvelope } from "@banijjik/contracts";
import { asId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { EventHandler } from "../../../../../kernel/events/index.js";
import { postingSourceMissing } from "../../domain/errors.js";
import {
  draftPeriodClosed,
  draftPeriodRevenueRecognized,
  type EnrollmentPeriodClosureSnapshot,
  type EnrollmentPeriodRecognitionSnapshot,
} from "../../domain/enrollment-posting-rules.js";
import type {
  EnrollmentPeriodPostingSnapshot,
  EnrollmentPeriodPostingSource,
} from "../ports/enrollment-posting-source.js";
import { postJournalEntry, type PostJournalDependencies } from "../post-journal.js";

export function buildPostEnrollmentsHandler(input: {
  readonly enrollments: EnrollmentPeriodPostingSource;
  readonly posting: PostJournalDependencies;
}): EventHandler<typeof ENROLLMENT_EVENT_TYPE.PERIOD_REVENUE_RECOGNIZED> {
  return {
    handlerKey: "accounting.postEnrollments",
    moduleKey: MODULE_KEY.ACCOUNTING,
    eventType: ENROLLMENT_EVENT_TYPE.PERIOD_REVENUE_RECOGNIZED,
    alsoHandles: [ENROLLMENT_EVENT_TYPE.PERIOD_REVENUE_CLOSED],
    ordering: "ORDERED",
    streamPrefixes: ["enrollmentPeriod:"],
    async handle(envelope) {
      await handleEnrollmentPeriodEvent(input, envelope);
    },
  };
}

function isClosedPayload(payload: unknown): payload is PeriodRevenueClosedPayload {
  return typeof payload === "object" && payload !== null && "recognizedBeforeCancel" in payload;
}

async function handleEnrollmentPeriodEvent(
  input: {
    readonly enrollments: EnrollmentPeriodPostingSource;
    readonly posting: PostJournalDependencies;
  },
  envelope: EventEnvelope<unknown>,
): Promise<void> {
  if (envelope.organizationId === null) throw postingSourceMissing("organization");
  const organizationId = asId<OrganizationId>(envelope.organizationId);
  const actorUserId = envelope.actorUserId === null ? null : asId<UserId>(envelope.actorUserId);
  const payload = envelope.payload;
  const enrollmentPeriodId = periodIdOf(payload);
  const snapshot = await input.enrollments.readPeriod({
    organizationId: envelope.organizationId,
    enrollmentPeriodId,
  });
  if (snapshot === undefined) throw postingSourceMissing(`enrollmentPeriod:${enrollmentPeriodId}`);

  const drafts =
    envelope.type === ENROLLMENT_EVENT_TYPE.PERIOD_REVENUE_CLOSED
      ? closedDrafts(snapshot, payload)
      : recognizedDrafts(snapshot);
  for (const draft of drafts) {
    await postJournalEntry(input.posting, { organizationId, actorUserId, draft });
  }
}

function periodIdOf(payload: unknown): string {
  if (typeof payload === "object" && payload !== null && "enrollmentPeriodId" in payload) {
    if (typeof payload.enrollmentPeriodId === "string") return payload.enrollmentPeriodId;
  }
  throw postingSourceMissing("enrollmentPeriod:payload");
}

function recognizedDrafts(snapshot: EnrollmentPeriodPostingSnapshot) {
  if (snapshot.revenueRecognizedOn === undefined) {
    throw postingSourceMissing(`enrollmentPeriod:${snapshot.enrollmentPeriodId}`);
  }
  const recognition: EnrollmentPeriodRecognitionSnapshot = {
    enrollmentPeriodId: snapshot.enrollmentPeriodId,
    businessDate: snapshot.revenueRecognizedOn,
    locationId: snapshot.locationId,
    fee: snapshot.fee,
    heldAdvance: snapshot.heldAdvance,
  };
  return draftPeriodRevenueRecognized(recognition);
}

function closedDrafts(snapshot: EnrollmentPeriodPostingSnapshot, payload: unknown) {
  if (!isClosedPayload(payload) || snapshot.cancelledOn === undefined) {
    throw postingSourceMissing(`enrollmentPeriod:${snapshot.enrollmentPeriodId}`);
  }
  const closure: EnrollmentPeriodClosureSnapshot = {
    enrollmentPeriodId: snapshot.enrollmentPeriodId,
    businessDate: snapshot.cancelledOn,
    locationId: snapshot.locationId,
    fee: snapshot.fee,
    heldAdvance: snapshot.heldAdvance,
    keptAmount: payload.keptAmount,
    recognizedAmount: payload.recognizedAmount,
    recognizedBeforeCancel: payload.recognizedBeforeCancel,
  };
  return draftPeriodClosed(closure);
}
