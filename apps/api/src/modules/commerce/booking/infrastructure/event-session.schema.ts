import { EVENT_SESSION_STATUS } from "@banijjik/contracts/booking";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";
import type { EventSessionProps } from "../domain/event-session.entity.js";
export const EVENT_SESSION_MODEL_NAME = "EventSession";
export const eventSessionSchema = new Schema<EventSessionProps>(
  {
    ...domainIdField("eventSessionId"),
    organizationId: { type: String, required: true, immutable: true },
    locationId: { type: String, required: true, immutable: true },
    offeringId: { type: String, required: true, immutable: true },
    variantId: { type: String, required: true, immutable: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    capacity: { type: Number, required: true },
    seatsSold: { type: Number, required: true, default: 0 },
    resourceIds: { type: [String], default: [] },
    status: { type: String, required: true, enum: Object.values(EVENT_SESSION_STATUS) },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);
eventSessionSchema.index({ organizationId: 1, locationId: 1, startsAt: 1 });
eventSessionSchema.index({ organizationId: 1, offeringId: 1, startsAt: 1 });
