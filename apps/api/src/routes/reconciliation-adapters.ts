import {
  EVENT_DEAD_LETTER_STATUS,
  OUTBOX_STATUS,
  SYSTEM_REASON,
  type ReconciliationSourceType,
} from "@banijjik/contracts";
import { runAsSystem } from "../kernel/context/run-as-system.js";
import { models } from "../kernel/db/index.js";
import { findModelDefinition } from "../kernel/db/model-registry.js";
import {
  OUTBOX_EVENT_MODEL_NAME,
  type OutboxEventDocument,
} from "../kernel/events/outbox-event.schema.js";
import {
  EVENT_DEAD_LETTER_MODEL_NAME,
  type EventDeadLetterDocument,
} from "../kernel/events/dead-letter.schema.js";
import type {
  ReconciliationSourceScanner,
  ScanSourcesInput,
} from "../modules/platform/operations/application/reconciliation-ports.js";
import type { ReconciledSourceItem } from "../modules/platform/operations/domain/reconciliation.entity.js";

interface OrderDoc {
  readonly orderId: string;
  readonly organizationId: string;
  readonly status: string;
  readonly createdAt: Date;
}

interface JournalDoc {
  readonly journalId: string;
  readonly organizationId: string;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly sourcePostingKey: string;
}

interface CourierSettlementDoc {
  readonly courierSettlementId: string;
  readonly organizationId: string;
  readonly createdAt: Date;
}

interface RiderHandoverDoc {
  readonly riderCashHandoverId: string;
  readonly organizationId: string;
  readonly createdAt: Date;
}

interface DiscrepancyCheckInput {
  readonly organizationId: string;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly sourcePostingKey: string;
  readonly payloadField: string;
}

interface DiscrepancyCheckResult {
  readonly isPosted: boolean;
  readonly hasPendingOutbox: boolean;
  readonly hasDeadLetter: boolean;
}

async function checkPostingStatus(
  input: DiscrepancyCheckInput,
): Promise<DiscrepancyCheckResult> {
  const hasJournal = findModelDefinition("Journal") !== undefined;
  const journal = hasJournal
    ? await models({})
        .get<JournalDoc>("Journal")
        .findOne({
          organizationId: input.organizationId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          sourcePostingKey: input.sourcePostingKey,
        })
        .lean<JournalDoc | null>()
    : null;

  if (journal !== null) {
    return { isPosted: true, hasPendingOutbox: false, hasDeadLetter: false };
  }

  let hasPendingOutbox = false;
  if (findModelDefinition(OUTBOX_EVENT_MODEL_NAME)) {
    const pending = await models({})
      .get<OutboxEventDocument>(OUTBOX_EVENT_MODEL_NAME)
      .findOne({
        organizationId: input.organizationId,
        [`payload.${input.payloadField}`]: input.sourceId,
        status: OUTBOX_STATUS.PENDING,
      })
      .lean<OutboxEventDocument | null>();
    hasPendingOutbox = pending !== null;
  }

  let hasDeadLetter = false;
  if (findModelDefinition(EVENT_DEAD_LETTER_MODEL_NAME)) {
    const dead = await models({})
      .get<EventDeadLetterDocument>(EVENT_DEAD_LETTER_MODEL_NAME)
      .findOne({
        organizationId: input.organizationId,
        [`payload.${input.payloadField}`]: input.sourceId,
        status: EVENT_DEAD_LETTER_STATUS.FAILED,
      })
      .lean<EventDeadLetterDocument | null>();
    hasDeadLetter = dead !== null;
  }

  return { isPosted: false, hasPendingOutbox, hasDeadLetter };
}

export function buildReconciliationSourceScanner(): ReconciliationSourceScanner {
  return {
    async scanSources(input: ScanSourcesInput): Promise<readonly ReconciledSourceItem[]> {
      return runAsSystem(SYSTEM_REASON.PLATFORM_ADMIN, async () => {
        if (input.sourceType === "SALES_ORDER") {
          return scanSalesOrders(input);
        }
        if (input.sourceType === "COURIER_SETTLEMENT") {
          return scanCourierSettlements(input);
        }
        if (input.sourceType === "RIDER_HANDOVER") {
          return scanRiderHandovers(input);
        }
        return [];
      });
    },
  };
}

async function scanSalesOrders(input: ScanSourcesInput): Promise<readonly ReconciledSourceItem[]> {
  if (!findModelDefinition("Order")) return [];

  const filter: Record<string, unknown> = { shippedAt: { $ne: null } };
  if (input.organizationId) filter["organizationId"] = input.organizationId;
  if (input.fromCreatedAt) {
    filter["$or"] = [
      { createdAt: { $gt: input.fromCreatedAt } },
      { createdAt: input.fromCreatedAt, orderId: { $gt: input.fromId ?? "" } },
    ];
  }

  const orderDocs = await models({})
    .get<OrderDoc>("Order")
    .find(filter)
    .sort({ createdAt: 1, orderId: 1 })
    .limit(input.limit)
    .lean<OrderDoc[]>();

  const results: ReconciledSourceItem[] = [];
  for (const order of orderDocs) {
    const status = await checkPostingStatus({
      organizationId: order.organizationId,
      sourceType: "ORDER",
      sourceId: order.orderId,
      sourcePostingKey: "order_revenue",
      payloadField: "orderId",
    });

    results.push({
      sourceType: "SALES_ORDER",
      sourceId: order.orderId,
      organizationId: order.organizationId,
      createdAt: order.createdAt,
      expectedTarget: "Journal[ORDER, order_revenue]",
      ...status,
    });
  }
  return results;
}

async function scanCourierSettlements(input: ScanSourcesInput): Promise<readonly ReconciledSourceItem[]> {
  if (!findModelDefinition("CourierSettlement")) return [];

  const filter: Record<string, unknown> = {};
  if (input.organizationId) filter["organizationId"] = input.organizationId;
  if (input.fromCreatedAt) {
    filter["$or"] = [
      { createdAt: { $gt: input.fromCreatedAt } },
      { createdAt: input.fromCreatedAt, courierSettlementId: { $gt: input.fromId ?? "" } },
    ];
  }

  const settlementDocs = await models({})
    .get<CourierSettlementDoc>("CourierSettlement")
    .find(filter)
    .sort({ createdAt: 1, courierSettlementId: 1 })
    .limit(input.limit)
    .lean<CourierSettlementDoc[]>();

  const results: ReconciledSourceItem[] = [];
  for (const s of settlementDocs) {
    const status = await checkPostingStatus({
      organizationId: s.organizationId,
      sourceType: "COURIER",
      sourceId: s.courierSettlementId,
      sourcePostingKey: "courier_settlement",
      payloadField: "courierSettlementId",
    });

    results.push({
      sourceType: "COURIER_SETTLEMENT",
      sourceId: s.courierSettlementId,
      organizationId: s.organizationId,
      createdAt: s.createdAt,
      expectedTarget: "Journal[COURIER, courier_settlement]",
      ...status,
    });
  }
  return results;
}

async function scanRiderHandovers(input: ScanSourcesInput): Promise<readonly ReconciledSourceItem[]> {
  if (!findModelDefinition("RiderCashHandover")) return [];

  const filter: Record<string, unknown> = {};
  if (input.organizationId) filter["organizationId"] = input.organizationId;
  if (input.fromCreatedAt) {
    filter["$or"] = [
      { createdAt: { $gt: input.fromCreatedAt } },
      { createdAt: input.fromCreatedAt, riderCashHandoverId: { $gt: input.fromId ?? "" } },
    ];
  }

  const handoverDocs = await models({})
    .get<RiderHandoverDoc>("RiderCashHandover")
    .find(filter)
    .sort({ createdAt: 1, riderCashHandoverId: 1 })
    .limit(input.limit)
    .lean<RiderHandoverDoc[]>();

  const results: ReconciledSourceItem[] = [];
  for (const h of handoverDocs) {
    const status = await checkPostingStatus({
      organizationId: h.organizationId,
      sourceType: "DELIVERY",
      sourceId: h.riderCashHandoverId,
      sourcePostingKey: "rider_handover",
      payloadField: "riderCashHandoverId",
    });

    results.push({
      sourceType: "RIDER_HANDOVER",
      sourceId: h.riderCashHandoverId,
      organizationId: h.organizationId,
      createdAt: h.createdAt,
      expectedTarget: "Journal[DELIVERY, rider_handover]",
      ...status,
    });
  }
  return results;
}
