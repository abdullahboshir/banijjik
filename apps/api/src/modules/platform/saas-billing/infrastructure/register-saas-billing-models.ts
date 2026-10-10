import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import {
  PLATFORM_SUBSCRIPTION_COLLECTION_NAME,
  PLATFORM_SUBSCRIPTION_MODEL_NAME,
  platformSubscriptionSchema,
} from "./platform-subscription.schema.js";

/** Registers the PlatformSubscription model: platform database, one open subscription per organization. */
export function registerSaasBillingModels(): void {
  registerModel({
    modelName: PLATFORM_SUBSCRIPTION_MODEL_NAME,
    collectionName: PLATFORM_SUBSCRIPTION_COLLECTION_NAME,
    database: DATABASE_KIND.PLATFORM,
    schema: platformSubscriptionSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
}
