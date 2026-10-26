import { ERROR_CODE } from "@banijjik/contracts";
import type { Model } from "mongoose";
import { SMS_OUTCOME, type SmsSource } from "@banijjik/contracts/sms";
import { newId } from "@banijjik/ids";
import type { SmsGatewayInput } from "@banijjik/validation/sms";
import { getRequestContext } from "../../../../kernel/context/index.js";
import {
  models,
  getActiveSession,
  sessionOption,
  isDuplicateKeyError,
} from "../../../../kernel/db/index.js";
import { AppError, conflict, validationFailed } from "../../../../kernel/http/index.js";
import { mergeGateway } from "../application/gateway-settings.js";
import type { SmsLogEntry, SmsRepository } from "../application/sms-service.js";
import { emptyGateway, type Gateway } from "../domain/gateway.js";
import type { GatewayDocument, SmsLogDocument } from "./sms.schema.js";

const GATEWAY_PROJECTION = {
  _id: 0,
  enabled: 1,
  activeProvider: 1,
  adareach: 1,
  bulksmsbd: 1,
  version: 1,
  updatedAt: 1,
};
const LOG_PROJECTION = {
  _id: 0,
  smsLogId: 1,
  purpose: 1,
  phoneLastDigits: 1,
  source: 1,
  provider: 1,
  outcome: 1,
  failureReason: 1,
  providerErrorCode: 1,
  parts: 1,
  providerMessageId: 1,
  businessDate: 1,
  createdAt: 1,
};

export class MongoSmsRepository implements SmsRepository {
  async gateway(platform: boolean): Promise<Gateway> {
    const model = models({}).get<GatewayDocument>(
      platform ? "PlatformSmsGateway" : "SmsGatewaySetting",
    );
    const row = await model
      .findOne(platform ? { scopeKey: "DEFAULT" } : {}, GATEWAY_PROJECTION)
      .session(getActiveSession() ?? null)
      .lean<GatewayDocument>();
    return row ?? emptyGateway();
  }

  async save(input: SmsGatewayInput, platform: boolean, now: Date): Promise<Gateway> {
    const previous = await this.gateway(platform);
    if (previous.version !== input.version) throw conflict({});
    const context = getRequestContext();
    const ownerId = platform ? "platform" : organizationId();
    const merged = mergeGateway({ previous, input, ownerId, now });
    const model = models({}).get<GatewayDocument>(
      platform ? "PlatformSmsGateway" : "SmsGatewaySetting",
    );
    const actor = context.userId ?? null;
    if (input.version === 0) {
      await createGateway({ model, ownerId, merged, actor, platform });
      return merged;
    }
    const result = await writeGateway({ model, version: input.version, merged, actor, platform });
    if (result.matchedCount === 0) throw conflict({});
    return merged;
  }

  async append(entry: SmsLogEntry): Promise<void> {
    const actor = getRequestContext().userId ?? null;
    await models({})
      .get<SmsLogDocument>("SmsLog")
      .create(
        [
          {
            ...entry,
            organizationId: organizationId(),
            version: 1,
            createdByUserId: actor,
            updatedByUserId: actor,
          },
        ],
        sessionOption(getActiveSession()),
      );
  }

  async countSent(from: string, to: string, source?: SmsSource): Promise<number> {
    return models({})
      .get<SmsLogDocument>("SmsLog")
      .countDocuments({
        businessDate: { $gte: from, $lte: to },
        outcome: SMS_OUTCOME.SENT,
        ...(source === undefined ? {} : { source }),
      })
      .session(getActiveSession() ?? null);
  }

  async list(query: {
    outcome?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
    cursor?: string | undefined;
    limit: number;
  }): Promise<{ items: SmsLogDocument[]; nextCursor: string | null }> {
    const filter = logFilter(query);
    const rows = await models({})
      .get<SmsLogDocument>("SmsLog")
      .find(filter, LOG_PROJECTION)
      .sort({ createdAt: -1, smsLogId: -1 })
      .limit(query.limit + 1)
      .lean<SmsLogDocument[]>();
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: page,
      nextCursor:
        rows.length > query.limit && last !== undefined
          ? Buffer.from(`${last.createdAt.toISOString()}|${last.smsLogId}`).toString("base64url")
          : null,
    };
  }
}

async function createGateway({
  model,
  ownerId,
  merged,
  actor,
  platform,
}: {
  model: Model<GatewayDocument>;
  ownerId: string;
  merged: Gateway;
  actor: string | null;
  platform: boolean;
}): Promise<void> {
  try {
    const identity = platform
      ? { scopeKey: "DEFAULT", platformSmsGatewayId: newId() }
      : { organizationId: ownerId, smsGatewaySettingId: newId() };
    await model.create(
      [
        {
          ...merged,
          ...identity,
          createdByUserId: actor,
          updatedByUserId: actor,
        },
      ],
      sessionOption(getActiveSession()),
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) throw conflict({});
    throw error;
  }
}

async function writeGateway({
  model,
  version,
  merged,
  actor,
  platform,
}: {
  model: Model<GatewayDocument>;
  version: number;
  merged: Gateway;
  actor: string | null;
  platform: boolean;
}) {
  try {
    return await model.updateOne(
      platform ? { scopeKey: "DEFAULT", version } : { version },
      { $set: { ...merged, updatedByUserId: actor } },
      sessionOption(getActiveSession()),
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) throw conflict({});
    throw error;
  }
}

function logFilter(query: {
  outcome?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  cursor?: string | undefined;
}): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  addOutcomeFilter(filter, query.outcome);
  addDateFilter(filter, query.from, query.to);
  if (query.cursor !== undefined) filter["$or"] = cursorFilter(query.cursor);
  return filter;
}

function addOutcomeFilter(filter: Record<string, unknown>, outcome: string | undefined): void {
  if (outcome !== undefined) filter["outcome"] = outcome;
}

function addDateFilter(
  filter: Record<string, unknown>,
  from: string | undefined,
  to: string | undefined,
): void {
  if (from === undefined && to === undefined) return;
  filter["businessDate"] = {
    ...(from === undefined ? {} : { $gte: from }),
    ...(to === undefined ? {} : { $lte: to }),
  };
}

function cursorFilter(cursor: string): Record<string, unknown>[] {
  const [timestamp, smsLogId, extra] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  if (
    !timestamp ||
    !smsLogId ||
    extra !== undefined ||
    !/^\d{4}-\d{2}-\d{2}T/.test(timestamp) ||
    !Number.isFinite(Date.parse(timestamp)) ||
    !/^[a-f0-9-]{36}$/.test(smsLogId)
  ) {
    throw validationFailed([{ path: "cursor", messageKey: "errors.validation_error" }]);
  }
  const createdAt = new Date(timestamp);
  return [{ createdAt: { $lt: createdAt } }, { createdAt, smsLogId: { $lt: smsLogId } }];
}

export function organizationId(): string {
  const value = getRequestContext().organizationId;
  if (value === undefined) throw new AppError({ code: ERROR_CODE.INTERNAL });
  return value;
}
