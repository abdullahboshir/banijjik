import type { ApprovalAction } from "@banijjik/contracts/iam";
import type { Money, PaymentMethod, PaymentRequestType } from "@banijjik/contracts/payment";
import type { PosSalePaymentResponse, PosSessionStatus } from "@banijjik/contracts/pos";
import type {
  LocationId,
  MemberId,
  OrganizationId,
  PosDeviceId,
  PosHeldCartId,
  PosSessionId,
  UserId,
} from "@banijjik/ids";
import type { PermissionKey } from "@banijjik/contracts";
import type { PosSnapshotPage, PosSnapshotQuery } from "../../../catalog/index.js";
import type { PosDevice } from "../../domain/pos-device.entity.js";
import type { PosHeldCart } from "../../domain/pos-held-cart.entity.js";
import type { PosSession } from "../../domain/pos-session.entity.js";
import type {
  SessionMethodTotal,
  SessionOrderAllocation,
} from "../../domain/session-payment-totals.js";
import type { SoldOrderTotals } from "../../domain/z-report.js";

export interface Page<T> {
  readonly items: readonly T[];
  readonly hasNext: boolean;
}

export interface PosDeviceRepository {
  /** The unique index on waiting pairing codes turns a collision into a retryable 409. */
  insert(device: PosDevice): Promise<void>;
  findById(posDeviceId: PosDeviceId): Promise<PosDevice | undefined>;
  findBySecretHash(secretHash: string): Promise<PosDevice | undefined>;
  findByPairingCodeHash(pairingCodeHash: string): Promise<PosDevice | undefined>;
  list(filter: {
    readonly locationId?: LocationId | undefined;
    readonly page: number;
    readonly limit: number;
  }): Promise<Page<PosDevice>>;
  /** Stores the secret and clears the code in one conditional write; false when the code was used or has expired. */
  claimPairing(input: {
    readonly posDeviceId: PosDeviceId;
    readonly pairingCodeHash: string;
    readonly secretHash: string;
    readonly now: Date;
    readonly actorUserId: UserId;
  }): Promise<PosDevice | undefined>;
  /** Throws a 409 for a stale version. */
  revoke(input: {
    readonly posDeviceId: PosDeviceId;
    readonly expectedVersion: number;
    readonly now: Date;
    readonly actorUserId: UserId;
  }): Promise<PosDevice>;
  touchLastSeen(posDeviceId: PosDeviceId, now: Date): Promise<void>;
}

export interface PosSessionListCursor {
  readonly openedAt: Date;
  readonly posSessionId: string;
}

export interface PosSessionRepository {
  /** A second OPEN session on a device answers `sessionAlreadyOpen` from the unique partial index. */
  insert(session: PosSession): Promise<void>;
  findById(posSessionId: PosSessionId): Promise<PosSession | undefined>;
  findOpenByDevice(posDeviceId: PosDeviceId): Promise<PosSession | undefined>;
  list(input: {
    readonly allowedLocationIds: readonly string[] | "ALL";
    readonly locationId?: LocationId | undefined;
    readonly status?: PosSessionStatus | undefined;
    readonly after?: PosSessionListCursor | undefined;
    readonly limit: number;
  }): Promise<{
    readonly items: readonly PosSession[];
    readonly next: PosSessionListCursor | null;
  }>;
  /** Writes `lastSaleAt` on the OPEN session; false when it is no longer open. The write is the conflict point with the close. */
  markSale(posSessionId: PosSessionId, now: Date): Promise<boolean>;
  /** Throws a 409 for a stale version. */
  close(session: PosSession, expectedVersion: number): Promise<PosSession>;
}

export interface PosHeldCartRepository {
  countActiveByDevice(posDeviceId: PosDeviceId, now: Date): Promise<number>;
  insert(cart: PosHeldCart): Promise<void>;
  listActiveByDevice(posDeviceId: PosDeviceId, now: Date): Promise<readonly PosHeldCart[]>;
  findById(posHeldCartId: PosHeldCartId): Promise<PosHeldCart | undefined>;
  deleteById(input: {
    readonly posHeldCartId: PosHeldCartId;
    readonly posDeviceId: PosDeviceId;
    readonly expectedVersion: number;
  }): Promise<boolean>;
}

export interface PosSettings {
  readonly requireShift: boolean;
  readonly allowCreditSale: boolean;
  readonly receiptFooter: string;
}

export interface PosSettingsReader {
  read(organizationId: OrganizationId, locationId: LocationId): Promise<PosSettings>;
}

export interface PosCaller {
  /** The signed-in member's id in the active organization. */
  memberIdOf(userId: UserId, organizationId: OrganizationId): Promise<MemberId>;
  /** Whether the caller holds the permission at the location (not only somewhere). */
  holdsAt(permissionKey: PermissionKey, locationId: string): Promise<boolean>;
}

export interface PosLocationReader {
  isActiveLocation(locationId: string): Promise<boolean>;
}

export interface PosCurrencyReader {
  read(organizationId: OrganizationId): Promise<Money["currency"]>;
}

export interface PosReceivePaymentInput {
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
  readonly method: PaymentMethod;
  readonly amount: Money;
  readonly externalReference: string | null;
  readonly orderId: string;
  readonly contactId: string | null;
  readonly receivedByMemberId: MemberId;
  readonly actorUserId: UserId;
  readonly posSessionId: PosSessionId | null;
}

export interface PosCollectPaymentInput {
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
  readonly method: PaymentMethod;
  readonly amount: Money;
  readonly externalReference: string | null;
  readonly allocations: readonly {
    readonly requestType: PaymentRequestType;
    readonly requestId: string;
    readonly amount: Money;
  }[];
  readonly contactId: string | null;
  readonly receivedByMemberId: MemberId;
  readonly actorUserId: UserId;
  readonly posSessionId: PosSessionId | null;
}

/** The payment module as the till sees it: take a payment, and read what a register has taken. */
export interface PosPaymentPort {
  receive(input: PosReceivePaymentInput): Promise<PosSalePaymentResponse>;
  collect(input: PosCollectPaymentInput): Promise<PosSalePaymentResponse>;
  methodTotals(input: {
    readonly organizationId: OrganizationId;
    readonly posSessionId: PosSessionId;
  }): Promise<readonly SessionMethodTotal[]>;
  collectionTotals(input: {
    readonly organizationId: OrganizationId;
    readonly posSessionId: PosSessionId;
    readonly soldOrderIds: readonly string[];
  }): Promise<readonly SessionMethodTotal[]>;
  orderAllocations(input: {
    readonly organizationId: OrganizationId;
    readonly posSessionId: PosSessionId;
  }): Promise<readonly SessionOrderAllocation[]>;
}

export interface PosRequestSnapshot {
  readonly requestId: string;
  readonly requestType: PaymentRequestType;
  readonly locationId: LocationId | null;
  readonly contactId: string | null;
}

export interface PosRequestReader {
  read(
    organizationId: OrganizationId,
    requestType: PaymentRequestType,
    requestId: string,
  ): Promise<PosRequestSnapshot | undefined>;
}

export interface PosApprovalVerifier {
  consume(
    token: string,
    expected: {
      readonly action: ApprovalAction;
      readonly subjectKey: string;
      readonly amount: Money;
    },
  ): Promise<void>;
}

/** The orders sold at one register, in one read: what the Z-report's sales come from (A2-6). */
export interface PosSoldOrdersReader {
  readByPosSession(posSessionId: PosSessionId): Promise<readonly SoldOrderTotals[]>;
}

/** The catalog module's keyset page of sellable variants for one location. */
export interface PosCatalogReader {
  readPage(query: PosSnapshotQuery): Promise<PosSnapshotPage>;
}

export interface PosUnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result>;
}

export interface PosEventPublisher {
  publish(
    type: string,
    payload: { readonly posSessionId: string },
    options: { readonly orderingKey: string },
  ): Promise<void>;
}

export interface PosRateLimit {
  /** Counts one pairing attempt of a member; throws 429 when the hourly allowance is spent. */
  consumePairingAttempt(memberKey: string): Promise<void>;
}
