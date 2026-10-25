import type { Money } from "@banijjik/contracts/payment";
import {
  POS_SESSION_STATUS,
  type PosSessionStatus,
  type PosZReport,
} from "@banijjik/contracts/pos";
import type {
  LocationId,
  MemberId,
  OrganizationId,
  PosDeviceId,
  PosSessionId,
  UserId,
} from "@banijjik/ids";

/** One register opened on one device with a float, closed with a counted drawer (plan decision 3). */
export interface PosSession {
  readonly posSessionId: PosSessionId;
  readonly organizationId: OrganizationId;
  readonly posDeviceId: PosDeviceId;
  readonly locationId: LocationId;
  readonly openedByMemberId: MemberId;
  readonly openingFloat: Money;
  readonly status: PosSessionStatus;
  readonly openedAt: Date;
  /** Written by every sale in its own transaction, so a sale and the close conflict on this document. */
  readonly lastSaleAt: Date | null;
  readonly closedAt: Date | null;
  readonly closedByMemberId: MemberId | null;
  readonly expectedCash: Money | null;
  readonly countedCash: Money | null;
  readonly variance: Money | null;
  readonly closeNote: string | null;
  readonly zReportNumber: string | null;
  readonly zReport: PosZReport | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}

export function newPosSession(input: {
  readonly posSessionId: PosSessionId;
  readonly organizationId: OrganizationId;
  readonly posDeviceId: PosDeviceId;
  readonly locationId: LocationId;
  readonly openedByMemberId: MemberId;
  readonly openingFloat: Money;
  readonly actorUserId: UserId;
  readonly now: Date;
}): PosSession {
  return {
    posSessionId: input.posSessionId,
    organizationId: input.organizationId,
    posDeviceId: input.posDeviceId,
    locationId: input.locationId,
    openedByMemberId: input.openedByMemberId,
    openingFloat: input.openingFloat,
    status: POS_SESSION_STATUS.OPEN,
    openedAt: input.now,
    lastSaleAt: null,
    closedAt: null,
    closedByMemberId: null,
    expectedCash: null,
    countedCash: null,
    variance: null,
    closeNote: null,
    zReportNumber: null,
    zReport: null,
    version: 1,
    createdAt: input.now,
    updatedAt: input.now,
    createdByUserId: input.actorUserId,
    updatedByUserId: input.actorUserId,
  };
}
