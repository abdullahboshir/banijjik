import { POS_DEVICE_STATUS, type PosDeviceStatus } from "@banijjik/contracts/pos";
import type { LocationId, OrganizationId, PosDeviceId, UserId } from "@banijjik/ids";

/** A tablet or till paired with one location (09 section 4, plan 3.9 decision 2). */
export interface PosDevice {
  readonly posDeviceId: PosDeviceId;
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
  readonly name: string;
  readonly status: PosDeviceStatus;
  /** SHA-256 of the cookie secret; null until the code is used. The secret itself is never stored. */
  readonly secretHash: string | null;
  /** HMAC of the one-time code; null once used or expired. */
  readonly pairingCodeHash: string | null;
  readonly pairingExpiresAt: Date | null;
  readonly pairedAt: Date | null;
  readonly lastSeenAt: Date | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}

export function newPosDevice(input: {
  readonly posDeviceId: PosDeviceId;
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
  readonly name: string;
  readonly pairingCodeHash: string;
  readonly pairingExpiresAt: Date;
  readonly actorUserId: UserId;
  readonly now: Date;
}): PosDevice {
  return {
    posDeviceId: input.posDeviceId,
    organizationId: input.organizationId,
    locationId: input.locationId,
    name: input.name,
    status: POS_DEVICE_STATUS.ACTIVE,
    secretHash: null,
    pairingCodeHash: input.pairingCodeHash,
    pairingExpiresAt: input.pairingExpiresAt,
    pairedAt: null,
    lastSeenAt: null,
    version: 1,
    createdAt: input.now,
    updatedAt: input.now,
    createdByUserId: input.actorUserId,
    updatedByUserId: input.actorUserId,
  };
}

/** A code works once, for a device that is still ACTIVE and not yet paired, until it expires. */
export function canPairWith(device: PosDevice, now: Date): boolean {
  return (
    device.status === POS_DEVICE_STATUS.ACTIVE &&
    device.secretHash === null &&
    device.pairingCodeHash !== null &&
    device.pairingExpiresAt !== null &&
    device.pairingExpiresAt.getTime() > now.getTime()
  );
}
