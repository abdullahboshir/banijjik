import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import { gatewaySchema, platformGatewaySchema, smsLogSchema } from "./sms.schema.js";

export function registerSmsModels(): void {
  registerModel({
    modelName: "SmsGatewaySetting",
    collectionName: "sms_gateway_settings",
    database: DATABASE_KIND.TENANT,
    tenancy: MODEL_TENANCY.ORGANIZATION,
    schema: gatewaySchema,
  });
  registerModel({
    modelName: "PlatformSmsGateway",
    collectionName: "platform_sms_gateways",
    database: DATABASE_KIND.PLATFORM,
    tenancy: MODEL_TENANCY.NONE,
    schema: platformGatewaySchema,
  });
  registerModel({
    modelName: "SmsLog",
    collectionName: "sms_logs",
    database: DATABASE_KIND.TENANT,
    tenancy: MODEL_TENANCY.ORGANIZATION,
    schema: smsLogSchema,
    appendOnly: true,
  });
}
