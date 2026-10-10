import { defineEnum } from "../define-enum.js";

/** Where an outbox event is in its life: waiting for the dispatcher, handed to the queue, or given up. */
export const OUTBOX_STATUS = defineEnum(["PENDING", "DISPATCHED", "DEAD"] as const);

export type OutboxStatus = (typeof OUTBOX_STATUS)[keyof typeof OUTBOX_STATUS];
