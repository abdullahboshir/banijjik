import { ERROR_CODE } from "@banijjik/contracts";
import { SMS_RULE_KEY } from "@banijjik/contracts/sms";
import type { SmsGatewayInput } from "@banijjik/validation/sms";
import { AppError } from "../../../../kernel/http/index.js";
import { sealSecret } from "../../../../kernel/secrets/index.js";
import { isComplete, type Gateway } from "../domain/gateway.js";

export interface GatewayMergeInput {
  readonly previous: Gateway;
  readonly input: SmsGatewayInput;
  readonly ownerId: string;
  readonly now: Date;
}

export function mergeGateway({ previous, input, ownerId, now }: GatewayMergeInput): Gateway {
  const gateway: Gateway = {
    enabled: input.enabled,
    activeProvider: input.activeProvider,
    adareach: mergeAdareach(previous, input, ownerId),
    bulksmsbd: mergeBulkSmsBd(previous, input, ownerId),
    version: previous.version + 1,
    updatedAt: now,
  };
  if (gateway.enabled && !isComplete(gateway)) {
    throw new AppError({
      code: ERROR_CODE.BUSINESS_RULE,
      details: { ruleKey: SMS_RULE_KEY.GATEWAY_INCOMPLETE },
    });
  }
  return gateway;
}

function mergeAdareach(
  previous: Gateway,
  input: SmsGatewayInput,
  ownerId: string,
): Gateway["adareach"] {
  if (input.adareach === undefined) return previous.adareach;
  if (input.adareach === null) return null;
  const provider = input.adareach;
  return {
    username: provider.username,
    senderId: provider.senderId,
    passwordSealed:
      provider.password === undefined
        ? (previous.adareach?.passwordSealed ?? "")
        : sealSecret(provider.password, `sms:${ownerId}:adareach.password`),
  };
}

function mergeBulkSmsBd(
  previous: Gateway,
  input: SmsGatewayInput,
  ownerId: string,
): Gateway["bulksmsbd"] {
  if (input.bulksmsbd === undefined) return previous.bulksmsbd;
  if (input.bulksmsbd === null) return null;
  const provider = input.bulksmsbd;
  return {
    senderId: provider.senderId,
    apiKeySealed:
      provider.apiKey === undefined
        ? (previous.bulksmsbd?.apiKeySealed ?? "")
        : sealSecret(provider.apiKey, `sms:${ownerId}:bulksmsbd.apiKey`),
  };
}

export interface GatewayView {
  readonly enabled: boolean;
  readonly activeProvider: Gateway["activeProvider"];
  readonly adareach: {
    readonly username: string;
    readonly senderId: string;
    readonly hasPassword: boolean;
  } | null;
  readonly bulksmsbd: { readonly senderId: string; readonly hasApiKey: boolean } | null;
  readonly version: number;
  readonly updatedAt: string;
}

export function gatewayView(gateway: Gateway): GatewayView {
  return {
    enabled: gateway.enabled,
    activeProvider: gateway.activeProvider,
    adareach:
      gateway.adareach === null
        ? null
        : {
            username: gateway.adareach.username,
            senderId: gateway.adareach.senderId,
            hasPassword: Boolean(gateway.adareach.passwordSealed),
          },
    bulksmsbd:
      gateway.bulksmsbd === null
        ? null
        : {
            senderId: gateway.bulksmsbd.senderId,
            hasApiKey: Boolean(gateway.bulksmsbd.apiKeySealed),
          },
    version: gateway.version,
    updatedAt: gateway.updatedAt.toISOString(),
  };
}

/** Names only, including nested secret field names: no values on either side of the audit. */
export function changedFieldNames(input: SmsGatewayInput): string[] {
  const fields = ["enabled", "activeProvider"];
  if (input.adareach !== undefined) {
    fields.push("adareach");
    if (input.adareach?.password !== undefined) fields.push("adareach.password");
  }
  if (input.bulksmsbd !== undefined) {
    fields.push("bulksmsbd");
    if (input.bulksmsbd?.apiKey !== undefined) fields.push("bulksmsbd.apiKey");
  }
  return fields;
}
