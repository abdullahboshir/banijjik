import {
  BOOKING_KIND,
  BOOKING_SOURCE,
  BOOKING_STATUS,
  type BookingHistoryEntry,
  type BookingKind,
  type BookingPriceSnapshot,
  type BookingSource,
  type BookingStatus,
  type Money,
} from "@banijjik/contracts/booking";
import {
  asId,
  newId,
  type BookingId,
  type ContactId,
  type EventSessionId,
  type LocationId,
  type MemberId,
  type OfferingId,
  type OrganizationId,
  type ResourceId,
  type UserId,
} from "@banijjik/ids";
import {
  transitionBookingProps,
  type BookingRescheduleTarget,
} from "./booking-transition-apply.js";
import { type BookingTransitionAction } from "./transitions.js";

export interface BookingProps {
  readonly bookingId: BookingId;
  readonly organizationId: OrganizationId;
  readonly bookingNumber: string | null;
  readonly locationId: LocationId;
  readonly contactId: ContactId;
  readonly offeringId: OfferingId;
  readonly variantId: string;
  readonly kind: BookingKind;
  readonly depositRequired: Money;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly blockedEndsAt: Date;
  readonly resourceIds: readonly ResourceId[];
  readonly providerMemberId: MemberId | null;
  readonly quantity: number;
  readonly price: BookingPriceSnapshot;
  readonly status: BookingStatus;
  readonly source: BookingSource;
  readonly note: string | null;
  readonly holdExpiresAt: Date | null;
  readonly cancellationFeeRetained?: Money | null;
  /** The session whose seats an EVENT booking holds; null for every other kind. */
  readonly eventSessionId?: EventSessionId | null;
  readonly history: readonly BookingHistoryEntry[];
  readonly version: number;
  readonly checkoutId?: string | null;
  readonly paymentFenceVersion?: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
  readonly updatedByUserId: UserId | null;
}

export class Booking {
  private constructor(private readonly props: BookingProps) {}

  static createStaff(input: {
    readonly organizationId: OrganizationId;
    readonly locationId: LocationId;
    readonly contactId: ContactId;
    readonly offeringId: OfferingId;
    readonly variantId: string;
    readonly kind?: BookingKind | undefined;
    readonly quantity?: number | undefined;
    readonly depositRequired: Money;
    readonly startsAt: Date;
    readonly endsAt: Date;
    readonly blockedEndsAt: Date;
    readonly resourceIds: readonly ResourceId[];
    readonly providerMemberId: MemberId | null;
    readonly price: BookingPriceSnapshot;
    readonly status: BookingStatus;
    readonly bookingNumber: string | null;
    readonly note: string | null;
    readonly eventSessionId?: EventSessionId | undefined;
    readonly now: Date;
    readonly actorUserId: UserId | null;
  }): Booking {
    return new Booking({
      bookingId: asId<BookingId>(newId()),
      organizationId: input.organizationId,
      bookingNumber: input.bookingNumber,
      locationId: input.locationId,
      contactId: input.contactId,
      offeringId: input.offeringId,
      variantId: input.variantId,
      kind: input.kind ?? BOOKING_KIND.SERVICE,
      depositRequired: input.depositRequired,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      blockedEndsAt: input.blockedEndsAt,
      resourceIds: input.resourceIds,
      providerMemberId: input.providerMemberId,
      quantity: input.quantity ?? 1,
      price: input.price,
      status: input.status,
      source: BOOKING_SOURCE.STAFF,
      note: input.note,
      holdExpiresAt: null,
      checkoutId: null,
      paymentFenceVersion: 0,
      eventSessionId: input.eventSessionId ?? null,
      history: [],
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    });
  }

  static createHold(input: {
    readonly organizationId: OrganizationId;
    readonly locationId: LocationId;
    readonly contactId: ContactId;
    readonly offeringId: OfferingId;
    readonly variantId: string;
    readonly kind?: BookingKind | undefined;
    readonly quantity?: number | undefined;
    readonly depositRequired: Money;
    readonly startsAt: Date;
    readonly endsAt: Date;
    readonly blockedEndsAt: Date;
    readonly resourceIds: readonly ResourceId[];
    readonly providerMemberId: MemberId | null;
    readonly price: BookingPriceSnapshot;
    readonly holdExpiresAt: Date;
    readonly note: string | null;
    readonly source: BookingSource;
    readonly checkoutId?: string | null | undefined;
    readonly paymentFenceVersion?: number | undefined;
    readonly eventSessionId?: EventSessionId | undefined;
    readonly now: Date;
    readonly actorUserId: UserId | null;
  }): Booking {
    return new Booking({
      bookingId: asId<BookingId>(newId()),
      organizationId: input.organizationId,
      bookingNumber: null,
      locationId: input.locationId,
      contactId: input.contactId,
      offeringId: input.offeringId,
      variantId: input.variantId,
      kind: input.kind ?? BOOKING_KIND.SERVICE,
      depositRequired: input.depositRequired,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      blockedEndsAt: input.blockedEndsAt,
      resourceIds: input.resourceIds,
      providerMemberId: input.providerMemberId,
      quantity: input.quantity ?? 1,
      price: input.price,
      status: BOOKING_STATUS.HELD,
      source: input.source,
      note: input.note,
      holdExpiresAt: input.holdExpiresAt,
      checkoutId: input.checkoutId ?? null,
      paymentFenceVersion: input.paymentFenceVersion ?? 0,
      eventSessionId: input.eventSessionId ?? null,
      history: [],
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    });
  }

  static rehydrate(props: BookingProps): Booking {
    return new Booking(props);
  }

  get bookingId(): BookingId {
    return this.props.bookingId;
  }

  get organizationId(): OrganizationId {
    return this.props.organizationId;
  }

  get bookingNumber(): string | null {
    return this.props.bookingNumber;
  }

  get locationId(): LocationId {
    return this.props.locationId;
  }

  get contactId(): ContactId {
    return this.props.contactId;
  }

  get offeringId(): OfferingId {
    return this.props.offeringId;
  }

  get variantId(): string {
    return this.props.variantId;
  }

  get kind(): BookingKind {
    return this.props.kind;
  }

  get depositRequired(): Money {
    return this.props.depositRequired;
  }

  get startsAt(): Date {
    return this.props.startsAt;
  }

  get endsAt(): Date {
    return this.props.endsAt;
  }

  get blockedEndsAt(): Date {
    return this.props.blockedEndsAt;
  }

  get resourceIds(): readonly ResourceId[] {
    return this.props.resourceIds;
  }

  get providerMemberId(): MemberId | null {
    return this.props.providerMemberId;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get price(): BookingPriceSnapshot {
    return this.props.price;
  }

  get status(): BookingStatus {
    return this.props.status;
  }

  get source(): BookingSource {
    return this.props.source;
  }

  get note(): string | null {
    return this.props.note;
  }

  get holdExpiresAt(): Date | null {
    return this.props.holdExpiresAt;
  }

  get eventSessionId(): EventSessionId | null {
    return this.props.eventSessionId ?? null;
  }

  get cancellationFeeRetained(): Money | null {
    return this.props.cancellationFeeRetained ?? null;
  }

  get checkoutId(): string | null {
    return this.props.checkoutId ?? null;
  }

  get paymentFenceVersion(): number {
    return this.props.paymentFenceVersion ?? 0;
  }

  get history(): readonly BookingHistoryEntry[] {
    return this.props.history;
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

  transition(
    action: BookingTransitionAction,
    input: {
      readonly now: Date;
      readonly actorUserId: UserId | null;
      readonly bookingNumber?: string | null;
      readonly note?: string;
      readonly cancellationFeeRetained?: Money | null;
      readonly reschedule?: BookingRescheduleTarget;
    },
  ): Booking {
    return new Booking(transitionBookingProps(this.props, action, input));
  }

  incrementPaymentFence(now: Date): Booking {
    return new Booking({
      ...this.props,
      paymentFenceVersion: (this.props.paymentFenceVersion ?? 0) + 1,
      version: this.props.version + 1,
      updatedAt: now,
    });
  }

  toProps(): BookingProps {
    return this.props;
  }
}
