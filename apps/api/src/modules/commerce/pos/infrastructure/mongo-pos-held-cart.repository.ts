import { POS_HELD_CART_MAX_PER_DEVICE, type PosHeldCartPayload } from "@banijjik/contracts/pos";
import {
  asId,
  type LocationId,
  type MemberId,
  type OrganizationId,
  type PosDeviceId,
  type PosHeldCartId,
  type UserId,
} from "@banijjik/ids";
import type { Model } from "mongoose";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { PosHeldCartRepository } from "../application/ports/pos-ports.js";
import type { PosHeldCart } from "../domain/pos-held-cart.entity.js";
import { POS_HELD_CART_MODEL_NAME, type PosHeldCartDocument } from "./pos.schema.js";

function heldCartModel(): Model<PosHeldCartDocument> {
  return models({}).get<PosHeldCartDocument>(POS_HELD_CART_MODEL_NAME);
}

function toUserId(value: string | null): UserId | null {
  return value === null ? null : asId<UserId>(value);
}

function toHeldCart(row: PosHeldCartDocument): PosHeldCart {
  return {
    posHeldCartId: asId<PosHeldCartId>(row.posHeldCartId),
    organizationId: asId<OrganizationId>(row.organizationId),
    locationId: asId<LocationId>(row.locationId),
    posDeviceId: asId<PosDeviceId>(row.posDeviceId),
    heldByMemberId: asId<MemberId>(row.heldByMemberId),
    label: row.label,
    cart: row.cart as PosHeldCartPayload,
    expiresAt: row.expiresAt,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByUserId: toUserId(row.createdByUserId),
    updatedByUserId: toUserId(row.updatedByUserId),
  };
}

export class MongoPosHeldCartRepository implements PosHeldCartRepository {
  async countActiveByDevice(posDeviceId: PosDeviceId, now: Date): Promise<number> {
    return heldCartModel().countDocuments(
      { posDeviceId, expiresAt: { $gt: now } },
      sessionOption(getActiveSession()),
    );
  }

  async insert(cart: PosHeldCart): Promise<void> {
    await heldCartModel().create([{ ...cart }], sessionOption(getActiveSession()));
  }

  async listActiveByDevice(posDeviceId: PosDeviceId, now: Date): Promise<readonly PosHeldCart[]> {
    const rows = await heldCartModel()
      .find({ posDeviceId, expiresAt: { $gt: now } }, null, sessionOption(getActiveSession()))
      .sort({ createdAt: -1, posHeldCartId: -1 })
      .limit(POS_HELD_CART_MAX_PER_DEVICE)
      .lean<PosHeldCartDocument[]>();
    return rows.map(toHeldCart);
  }

  async findById(posHeldCartId: PosHeldCartId): Promise<PosHeldCart | undefined> {
    const row = await heldCartModel()
      .findOne({ posHeldCartId }, null, sessionOption(getActiveSession()))
      .lean<PosHeldCartDocument>();
    return row === null ? undefined : toHeldCart(row);
  }

  async deleteById(input: {
    readonly posHeldCartId: PosHeldCartId;
    readonly posDeviceId: PosDeviceId;
    readonly expectedVersion: number;
  }): Promise<boolean> {
    const result = await heldCartModel().deleteOne(
      {
        posHeldCartId: input.posHeldCartId,
        posDeviceId: input.posDeviceId,
        version: input.expectedVersion,
      },
      sessionOption(getActiveSession()),
    );
    return result.deletedCount === 1;
  }
}
