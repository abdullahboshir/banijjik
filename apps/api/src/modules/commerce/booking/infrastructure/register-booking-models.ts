import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import {
  BOOKING_COLLECTION_NAME,
  BOOKING_MODEL_NAME,
  RESOURCE_COLLECTION_NAME,
  RESOURCE_MODEL_NAME,
  RESOURCE_SLOT_USAGE_COLLECTION_NAME,
  RESOURCE_SLOT_USAGE_MODEL_NAME,
  RESOURCE_TIME_OFF_COLLECTION_NAME,
  RESOURCE_TIME_OFF_MODEL_NAME,
  bookingSchema,
  resourceSchema,
  resourceSlotUsageSchema,
  resourceTimeOffSchema,
} from "./booking.schema.js";

import { EVENT_SESSION_MODEL_NAME, eventSessionSchema } from "./event-session.schema.js";

export function registerBookingModels(): void {
  registerModel({
    database: DATABASE_KIND.TENANT,
    modelName: EVENT_SESSION_MODEL_NAME,
    collectionName: "event_sessions",
    schema: eventSessionSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION_AND_LOCATION,
  });
  const tenant = { database: DATABASE_KIND.TENANT } as const;
  registerModel({
    ...tenant,
    modelName: RESOURCE_MODEL_NAME,
    collectionName: RESOURCE_COLLECTION_NAME,
    schema: resourceSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION_AND_LOCATION,
  });
  registerModel({
    ...tenant,
    modelName: RESOURCE_TIME_OFF_MODEL_NAME,
    collectionName: RESOURCE_TIME_OFF_COLLECTION_NAME,
    schema: resourceTimeOffSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION_AND_LOCATION,
  });
  registerModel({
    ...tenant,
    modelName: BOOKING_MODEL_NAME,
    collectionName: BOOKING_COLLECTION_NAME,
    schema: bookingSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION_AND_LOCATION,
  });
  registerModel({
    ...tenant,
    modelName: RESOURCE_SLOT_USAGE_MODEL_NAME,
    collectionName: RESOURCE_SLOT_USAGE_COLLECTION_NAME,
    schema: resourceSlotUsageSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
}
