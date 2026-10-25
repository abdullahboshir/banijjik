import { POS_SESSION_STATUS } from "@banijjik/contracts/pos";
import {
  asId,
  type LocationId,
  type MemberId,
  type OrganizationId,
  type PosDeviceId,
  type PosSessionId,
  type UserId,
} from "@banijjik/ids";
import type { Model } from "mongoose";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type { PosSessionRepository } from "../application/ports/pos-ports.js";
import { sessionAlreadyOpen } from "../domain/errors.js";
import type { PosSession } from "../domain/pos-session.entity.js";
import {
  POS_SESSION_MODEL_NAME,
  type MoneyDocument,
  type PosSessionDocument,
} from "./pos.schema.js";

function sessionModel(): Model<PosSessionDocument> {
  return models({}).get<PosSessionDocument>(POS_SESSION_MODEL_NAME);
}

function toUserId(value: string | null): UserId | null {
  return value === null ? null : asId<UserId>(value);
}

function toMoney(value: MoneyDocument | null): PosSession["expectedCash"] {
  return value === null ? null : { amount: value.amount, currency: value.currency };
}

function toSession(row: PosSessionDocument): PosSession {
  return {
    posSessionId: asId<PosSessionId>(row.posSessionId),
    organizationId: asId<OrganizationId>(row.organizationId),
    posDeviceId: asId<PosDeviceId>(row.posDeviceId),
    locationId: asId<LocationId>(row.locationId),
    openedByMemberId: asId<MemberId>(row.openedByMemberId),
    openingFloat: { amount: row.openingFloat.amount, currency: row.openingFloat.currency },
    status: row.status,
    openedAt: row.openedAt,
    lastSaleAt: row.lastSaleAt,
    closedAt: row.closedAt,
    closedByMemberId: row.closedByMemberId === null ? null : asId<MemberId>(row.closedByMemberId),
    expectedCash: toMoney(row.expectedCash),
    countedCash: toMoney(row.countedCash),
    variance: toMoney(row.variance),
    closeNote: row.closeNote,
    zReportNumber: row.zReportNumber,
    zReport: row.zReport,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByUserId: toUserId(row.createdByUserId),
    updatedByUserId: toUserId(row.updatedByUserId),
  };
}

export class MongoPosSessionRepository implements PosSessionRepository {
  async insert(session: PosSession): Promise<void> {
    try {
      await sessionModel().create([{ ...session }], sessionOption(getActiveSession()));
    } catch (error) {
      if (isDuplicateKeyError(error, "posDeviceId")) throw sessionAlreadyOpen(null);
      throw error;
    }
  }

  async findById(posSessionId: PosSessionId): Promise<PosSession | undefined> {
    const row = await sessionModel()
      .findOne({ posSessionId }, null, sessionOption(getActiveSession()))
      .lean<PosSessionDocument>();
    return row === null ? undefined : toSession(row);
  }

  async findOpenByDevice(posDeviceId: PosDeviceId): Promise<PosSession | undefined> {
    const row = await sessionModel()
      .findOne(
        { posDeviceId, status: POS_SESSION_STATUS.OPEN },
        null,
        sessionOption(getActiveSession()),
      )
      .lean<PosSessionDocument>();
    return row === null ? undefined : toSession(row);
  }

  async markSale(posSessionId: PosSessionId, now: Date): Promise<boolean> {
    const result = await sessionModel().updateOne(
      { posSessionId, status: POS_SESSION_STATUS.OPEN },
      { $set: { lastSaleAt: now } },
      sessionOption(getActiveSession()),
    );
    return result.matchedCount === 1;
  }

  async close(session: PosSession, expectedVersion: number): Promise<PosSession> {
    const row = await updateVersioned({
      model: sessionModel(),
      filter: { posSessionId: session.posSessionId, status: POS_SESSION_STATUS.OPEN },
      expectedVersion,
      update: {
        $set: {
          status: session.status,
          closedAt: session.closedAt,
          closedByMemberId: session.closedByMemberId,
          expectedCash: session.expectedCash,
          countedCash: session.countedCash,
          variance: session.variance,
          closeNote: session.closeNote,
          zReportNumber: session.zReportNumber,
          zReport: session.zReport,
          updatedByUserId: session.updatedByUserId,
        },
      },
    });
    return toSession(row);
  }
}
