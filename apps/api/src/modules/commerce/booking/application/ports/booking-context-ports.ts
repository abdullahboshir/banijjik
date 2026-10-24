import { OFFERING_KIND } from "@banijjik/contracts";
import type { EventDetails, RentalDetails, ServiceDetails } from "@banijjik/contracts/catalog";
import type { QuoteResponse } from "@banijjik/contracts/pricing";
import type { ContactId, LocationId, OfferingId, OrganizationId } from "@banijjik/ids";

export interface ServiceOfferingView {
  readonly kind?: typeof OFFERING_KIND.SERVICE;
  readonly offeringId: OfferingId;
  readonly variantId: string;
  readonly name: string;
  readonly service: ServiceDetails;
  readonly durationMinutes: number;
  readonly isActive: boolean;
}

export interface RentalOfferingView {
  readonly kind: typeof OFFERING_KIND.RENTAL;
  readonly offeringId: OfferingId;
  readonly variantId: string;
  readonly name: string;
  readonly rental: RentalDetails;
  readonly isActive: boolean;
}

export interface EventOfferingView {
  readonly kind: typeof OFFERING_KIND.EVENT;
  readonly offeringId: OfferingId;
  readonly variantId: string;
  readonly name: string;
  readonly event: EventDetails;
  readonly isActive: boolean;
}

export type OfferingBookingView = ServiceOfferingView | RentalOfferingView | EventOfferingView;

export interface BookingOfferingReader {
  readServiceOffering(input: {
    readonly organizationId: OrganizationId;
    readonly offeringId: OfferingId;
    readonly variantId: string;
    readonly locationId: LocationId;
  }): Promise<ServiceOfferingView | undefined>;

  readOffering(input: {
    readonly organizationId: OrganizationId;
    readonly offeringId: OfferingId;
    readonly variantId: string;
    readonly locationId: LocationId;
  }): Promise<OfferingBookingView | undefined>;
}

export interface BookingSettings {
  readonly slotStepMinutes: number;
  readonly minNoticeMinutes: number;
  readonly requireApproval: boolean;
  readonly holdMinutes: number;
  readonly noShowAfterMinutes: number;
  readonly depositRequired: import("@banijjik/contracts/booking").DepositRequired;
  readonly depositValue: number;
  readonly freeCancelHours?: number;
  readonly lateCancelFee?: import("@banijjik/contracts/booking").CancelFeeMode;
  readonly noShowFee?: import("@banijjik/contracts/booking").CancelFeeMode;
  readonly feePercent?: number;
  readonly completeGraceMinutes?: number;
}

export interface BookingSettingsReader {
  read(organizationId: OrganizationId): Promise<BookingSettings>;
}

export interface OrganizationTimezoneReader {
  read(organizationId: OrganizationId): Promise<string>;
}

export interface ResourceTypeCatalog {
  isKnownType(resourceTypeKey: string, organizationId: OrganizationId): Promise<boolean>;
  memberRequired(resourceTypeKey: string, organizationId: OrganizationId): Promise<boolean>;
}

export interface MemberLocationChecker {
  isMemberAtLocation(memberId: string, locationId: LocationId): Promise<boolean>;
}

export interface ContactCreator {
  isActive(contactId: ContactId): Promise<boolean>;
  create(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: string | null;
    readonly allowedLocationIds: readonly string[] | "ALL";
    readonly name: string;
    readonly phone: string;
  }): Promise<ContactId>;
}

export interface PriceQuoterPort {
  quote(input: {
    readonly organizationId: OrganizationId;
    readonly locationId: string;
    readonly offeringId: string;
    readonly variantId: string;
    readonly quantity?: number;
  }): Promise<QuoteResponse>;
}
