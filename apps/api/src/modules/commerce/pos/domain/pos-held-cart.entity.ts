import { POS_HELD_CART_TTL_HOURS, type PosHeldCartPayload } from "@banijjik/contracts/pos";
import type {
  LocationId,
  MemberId,
  OrganizationId,
  PosDeviceId,
  PosHeldCartId,
  UserId,
} from "@banijjik/ids";

const MILLISECONDS_PER_HOUR = 3_600_000;

/** A parked basket on one till, without prices or payments (plan 3.9 A2-1). */
export interface PosHeldCart {
  readonly posHeldCartId: PosHeldCartId;
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
  readonly posDeviceId: PosDeviceId;
  readonly heldByMemberId: MemberId;
  readonly label: string;
  readonly cart: PosHeldCartPayload;
  readonly expiresAt: Date;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}

export function newPosHeldCart(input: {
  readonly posHeldCartId: PosHeldCartId;
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
  readonly posDeviceId: PosDeviceId;
  readonly heldByMemberId: MemberId;
  readonly label: string;
  readonly cart: PosHeldCartPayload;
  readonly actorUserId: UserId;
  readonly now: Date;
}): PosHeldCart {
  return {
    posHeldCartId: input.posHeldCartId,
    organizationId: input.organizationId,
    locationId: input.locationId,
    posDeviceId: input.posDeviceId,
    heldByMemberId: input.heldByMemberId,
    label: input.label,
    cart: input.cart,
    expiresAt: new Date(input.now.getTime() + POS_HELD_CART_TTL_HOURS * MILLISECONDS_PER_HOUR),
    version: 1,
    createdAt: input.now,
    updatedAt: input.now,
    createdByUserId: input.actorUserId,
    updatedByUserId: input.actorUserId,
  };
}
