import {
  COLLECTION_CLAIM_STATE,
  type CollectionClaimCarrierInfo,
  type CollectionClaimState,
} from "@banijjik/contracts/payment";
import type { CollectionClaimId, OrderId, OrganizationId, PaymentId, UserId } from "@banijjik/ids";
import { collectionClaimActiveError, collectionClaimNotOpenError } from "./errors.js";

export interface CollectionClaimProps {
  readonly collectionClaimId: CollectionClaimId;
  readonly organizationId: OrganizationId;
  readonly paymentId: PaymentId;
  readonly orderId: OrderId;
  readonly carrier: CollectionClaimCarrierInfo;
  readonly state: CollectionClaimState;
  readonly generation: number;
  readonly claimedByReference: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}

export class CollectionClaim {
  private constructor(private readonly props: CollectionClaimProps) {}

  static create(props: CollectionClaimProps): CollectionClaim {
    return new CollectionClaim(props);
  }

  toProps(): CollectionClaimProps {
    return { ...this.props };
  }

  get collectionClaimId(): CollectionClaimId {
    return this.props.collectionClaimId;
  }

  get organizationId(): OrganizationId {
    return this.props.organizationId;
  }

  get paymentId(): PaymentId {
    return this.props.paymentId;
  }

  get orderId(): OrderId {
    return this.props.orderId;
  }

  get carrier(): CollectionClaimCarrierInfo {
    return this.props.carrier;
  }

  get state(): CollectionClaimState {
    return this.props.state;
  }

  get generation(): number {
    return this.props.generation;
  }

  get claimedByReference(): string | null {
    return this.props.claimedByReference;
  }

  get version(): number {
    return this.props.version;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get createdByUserId(): UserId | null {
    return this.props.createdByUserId;
  }

  get updatedByUserId(): UserId | null {
    return this.props.updatedByUserId;
  }

  claim(claimedByReference: string, actorUserId: UserId | null, now: Date): CollectionClaim {
    if (this.props.state !== COLLECTION_CLAIM_STATE.OPEN) {
      throw collectionClaimNotOpenError(this.props.paymentId, this.props.state);
    }
    return new CollectionClaim({
      ...this.props,
      state: COLLECTION_CLAIM_STATE.CLAIMED,
      claimedByReference,
      updatedAt: now,
      updatedByUserId: actorUserId,
    });
  }

  release(actorUserId: UserId | null, now: Date): CollectionClaim {
    if (this.props.state !== COLLECTION_CLAIM_STATE.CLAIMED) {
      throw collectionClaimActiveError(this.props.paymentId);
    }
    return new CollectionClaim({
      ...this.props,
      state: COLLECTION_CLAIM_STATE.OPEN,
      claimedByReference: null,
      generation: this.props.generation + 1,
      updatedAt: now,
      updatedByUserId: actorUserId,
    });
  }

  reverse(actorUserId: UserId | null, now: Date): CollectionClaim {
    if (this.props.state !== COLLECTION_CLAIM_STATE.OPEN) {
      throw collectionClaimActiveError(this.props.paymentId);
    }
    return new CollectionClaim({
      ...this.props,
      state: COLLECTION_CLAIM_STATE.REVERSED,
      updatedAt: now,
      updatedByUserId: actorUserId,
    });
  }
}
