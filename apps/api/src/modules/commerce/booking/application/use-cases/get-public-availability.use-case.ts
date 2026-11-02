import type { AvailabilitySlot } from "@banijjik/contracts/booking";
import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import type { OrganizationId } from "@banijjik/ids";
import { AppError } from "../../../../../kernel/http/index.js";
import { GetAvailabilityUseCase } from "./get-availability.use-case.js";

export interface PublicAvailabilityQuery {
  readonly offeringId: string;
  readonly variantId: string;
  readonly locationId: string;
  readonly startDate: string;
  readonly endDate: string;
}

const MS_PER_DAY = 86_400_000;

export interface PublicAvailabilityDay {
  readonly date: string;
  readonly slots: readonly AvailabilitySlot[];
}

export interface PublicAvailabilityResponse {
  readonly offeringId: string;
  readonly variantId: string;
  readonly locationId: string;
  readonly days: readonly PublicAvailabilityDay[];
}

function notAvailable(): AppError {
  return new AppError({
    code: ERROR_CODE.NOT_FOUND,
    messageKey: "errors.storefront_not_available",
  });
}

function locationMismatch(): AppError {
  return new AppError({
    code: ERROR_CODE.CHECKOUT_LOCATION_MISMATCH,
    messageKey: "errors.checkout_location_mismatch",
  });
}

function assertPublicLocationAllowed(
  locationId: string,
  publicLocationIds: readonly string[],
): void {
  if (publicLocationIds.length > 0 && !publicLocationIds.includes(locationId)) {
    throw locationMismatch();
  }
}

function eachLocalDate(startDate: string, endDate: string): readonly string[] {
  const dates: string[] = [];
  let currentMs = Date.parse(`${startDate}T00:00:00.000Z`);
  const endMs = Date.parse(`${endDate}T00:00:00.000Z`);
  while (currentMs <= endMs) {
    dates.push(new Date(currentMs).toISOString().slice(0, 10));
    currentMs += MS_PER_DAY;
  }
  return dates;
}

export class GetPublicAvailabilityUseCase {
  constructor(private readonly getAvailability: GetAvailabilityUseCase) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly publicLocationIds: readonly string[];
    readonly query: PublicAvailabilityQuery;
  }): Promise<PublicAvailabilityResponse> {
    assertPublicLocationAllowed(input.query.locationId, input.publicLocationIds);
    const allowedLocationIds =
      input.publicLocationIds.length === 0 ? "ALL" : input.publicLocationIds;
    const days: PublicAvailabilityDay[] = [];
    for (const date of eachLocalDate(input.query.startDate, input.query.endDate)) {
      days.push({
        date,
        slots: await this.slotsForDate({
          organizationId: input.organizationId,
          allowedLocationIds,
          query: input.query,
          date,
        }),
      });
    }
    return {
      offeringId: input.query.offeringId,
      variantId: input.query.variantId,
      locationId: input.query.locationId,
      days,
    };
  }

  private async slotsForDate(input: {
    readonly organizationId: OrganizationId;
    readonly allowedLocationIds: readonly string[] | "ALL";
    readonly query: PublicAvailabilityQuery;
    readonly date: string;
  }): Promise<readonly AvailabilitySlot[]> {
    try {
      return await this.getAvailability.execute({
        organizationId: input.organizationId,
        allowedLocationIds: input.allowedLocationIds,
        query: {
          offeringId: input.query.offeringId,
          variantId: input.query.variantId,
          locationId: input.query.locationId,
          date: input.date,
        },
      });
    } catch (error) {
      if (error instanceof DomainRuleError) throw notAvailable();
      throw error;
    }
  }
}
