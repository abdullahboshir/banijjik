import { defineEnum } from "../define-enum.js";

export const SUBSCRIPTION_STATUS = defineEnum(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED"]);

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];
