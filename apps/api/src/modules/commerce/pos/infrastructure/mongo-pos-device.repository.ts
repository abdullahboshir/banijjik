import { POS_DEVICE_STATUS } from "@banijjik/contracts/pos";
import {
  asId,
  type LocationId,
  type OrganizationId,
  type PosDeviceId,
  type UserId,
} from "@banijjik/ids";
import type { Model, QueryFilter } from "mongoose";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type { Page, PosDeviceRepository } from "../application/ports/pos-ports.js";
import { retryableConflict } from "../domain/errors.js";
import type { PosDevice } from "../domain/pos-device.entity.js";
import { POS_DEVICE_MODEL_NAME, type PosDeviceDocument } from "./pos.schema.js";

function deviceModel(): Model<PosDeviceDocument> {
  return models({}).get<PosDeviceDocument>(POS_DEVICE_MODEL_NAME);
}

function toUserId(value: string | null): UserId | null {
  return value === null ? null : asId<UserId>(value);
}

function deviceListQuery(filter: {
  readonly allowedLocationIds: readonly string[] | "ALL";
  readonly locationId?: LocationId | undefined;
}): QueryFilter<PosDeviceDocument> {
  if (filter.locationId !== undefined) return { locationId: filter.locationId };
  if (filter.allowedLocationIds === "ALL") return {};
  return { locationId: { $in: [...filter.allowedLocationIds] } };
}

function toDevice(row: PosDeviceDocument): PosDevice {
  return {
    posDeviceId: asId<PosDeviceId>(row.posDeviceId),
    organizationId: asId<OrganizationId>(row.organizationId),
    locationId: asId<LocationId>(row.locationId),
    name: row.name,
    status: row.status,
    secretHash: row.secretHash,
    pairingCodeHash: row.pairingCodeHash,
    pairingExpiresAt: row.pairingExpiresAt,
    pairedAt: row.pairedAt,
    lastSeenAt: row.lastSeenAt,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByUserId: toUserId(row.createdByUserId),
    updatedByUserId: toUserId(row.updatedByUserId),
  };
}

export class MongoPosDeviceRepository implements PosDeviceRepository {
  async insert(device: PosDevice): Promise<void> {
    try {
      await deviceModel().create([{ ...device }], sessionOption(getActiveSession()));
    } catch (error) {
      if (isDuplicateKeyError(error, "pairingCodeHash")) throw retryableConflict();
      throw error;
    }
  }

  async findById(posDeviceId: PosDeviceId): Promise<PosDevice | undefined> {
    const row = await deviceModel()
      .findOne({ posDeviceId }, null, sessionOption(getActiveSession()))
      .lean<PosDeviceDocument>();
    return row === null ? undefined : toDevice(row);
  }

  async findBySecretHash(secretHash: string): Promise<PosDevice | undefined> {
    const row = await deviceModel().findOne({ secretHash }).lean<PosDeviceDocument>();
    return row === null ? undefined : toDevice(row);
  }

  async findByPairingCodeHash(pairingCodeHash: string): Promise<PosDevice | undefined> {
    const row = await deviceModel().findOne({ pairingCodeHash }).lean<PosDeviceDocument>();
    return row === null ? undefined : toDevice(row);
  }

  async list(filter: {
    readonly allowedLocationIds: readonly string[] | "ALL";
    readonly locationId?: LocationId | undefined;
    readonly page: number;
    readonly limit: number;
  }): Promise<Page<PosDevice>> {
    const rows = await deviceModel()
      .find(deviceListQuery(filter))
      .sort({ createdAt: -1, posDeviceId: -1 })
      .skip((filter.page - 1) * filter.limit)
      .limit(filter.limit + 1)
      .lean<PosDeviceDocument[]>();
    return {
      items: rows.slice(0, filter.limit).map(toDevice),
      hasNext: rows.length > filter.limit,
    };
  }

  countActive(): Promise<number> {
    return deviceModel().countDocuments(
      { status: POS_DEVICE_STATUS.ACTIVE },
      sessionOption(getActiveSession()),
    );
  }

  async claimPairing(input: {
    readonly posDeviceId: PosDeviceId;
    readonly pairingCodeHash: string;
    readonly secretHash: string;
    readonly now: Date;
    readonly actorUserId: UserId;
  }): Promise<PosDevice | undefined> {
    // One conditional write decides: a code used a moment ago, or expired, matches nothing.
    const row = await deviceModel()
      .findOneAndUpdate(
        {
          posDeviceId: input.posDeviceId,
          status: POS_DEVICE_STATUS.ACTIVE,
          secretHash: null,
          pairingCodeHash: input.pairingCodeHash,
          pairingExpiresAt: { $gt: input.now },
        },
        {
          $set: {
            secretHash: input.secretHash,
            pairingCodeHash: null,
            pairingExpiresAt: null,
            pairedAt: input.now,
            lastSeenAt: input.now,
            updatedByUserId: input.actorUserId,
          },
          $inc: { version: 1 },
        },
        { returnDocument: "after", ...sessionOption(getActiveSession()) },
      )
      .lean<PosDeviceDocument>();
    return row === null ? undefined : toDevice(row);
  }

  async revoke(input: {
    readonly posDeviceId: PosDeviceId;
    readonly expectedVersion: number;
    readonly now: Date;
    readonly actorUserId: UserId;
  }): Promise<PosDevice> {
    const row = await updateVersioned({
      model: deviceModel(),
      filter: { posDeviceId: input.posDeviceId },
      expectedVersion: input.expectedVersion,
      update: {
        $set: {
          status: POS_DEVICE_STATUS.REVOKED,
          // A revoked device cannot pair later with a code it never used.
          pairingCodeHash: null,
          pairingExpiresAt: null,
          updatedByUserId: input.actorUserId,
        },
      },
    });
    return toDevice(row);
  }

  async touchLastSeen(posDeviceId: PosDeviceId, now: Date): Promise<void> {
    await deviceModel().updateOne({ posDeviceId }, { $set: { lastSeenAt: now } });
  }
}
