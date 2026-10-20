import type { ServiceDetails } from "@banijjik/contracts/catalog";
import type { QuoteResponse } from "@banijjik/contracts/pricing";
import type { ContactId, LocationId, OfferingId, OrganizationId } from "@banijjik/ids";

export interface ServiceOfferingView {
  readonly offeringId: OfferingId;
  readonly variantId: string;
  readonly name: string;
  readonly service: ServiceDetails;
  readonly durationMinutes: number;
  readonly isActive: boolean;
}

export interface BookingOfferingReader {
  readServiceOffering(input: {
    readonly organizationId: OrganizationId;
    readonly offeringId: OfferingId;
    readonly variantId: string;
    readonly locationId: LocationId;
  }): Promise<ServiceOfferingView | undefined>;
}

export interface BookingSettings {
  readonly slotStepMinutes: number;
  readonly minNoticeMinutes: number;
  readonly requireApproval: boolean;
  readonly holdMinutes: number;
  readonly noShowAfterMinutes: number;
  readonly depositRequired: import("@banijjik/contracts/booking").DepositRequired;
  readonly depositValue: number;
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
  }): Promise<QuoteResponse>;
}
