import { ERROR_CODE, LOCATION_STATUS } from "@banijjik/contracts";
import type { OrganizationId } from "@banijjik/ids";
import { AppError } from "../../../../../kernel/http/index.js";
import type { LocationManagementRepository } from "../../../../core/organization/index.js";

const PUBLIC_LOCATION_PAGE = 1;
const PUBLIC_LOCATION_LIMIT = 100;

export interface PublicLocationItem {
  readonly locationId: string;
  readonly name: string;
}

function notAvailable(): AppError {
  return new AppError({
    code: ERROR_CODE.NOT_FOUND,
    messageKey: "errors.storefront_not_available",
  });
}

export class ListPublicLocationsUseCase {
  constructor(private readonly locations: LocationManagementRepository) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly publicLocationIds: readonly string[];
  }): Promise<{ readonly items: readonly PublicLocationItem[] }> {
    if (input.organizationId.length === 0) throw notAvailable();
    const page = await this.locations.list({
      page: PUBLIC_LOCATION_PAGE,
      limit: PUBLIC_LOCATION_LIMIT,
      status: LOCATION_STATUS.ACTIVE,
      visibleLocationIds: "ALL",
    });
    const allowed = input.publicLocationIds;
    const items = page.items
      .filter((location) => allowed.length === 0 || allowed.includes(location.locationId))
      .map((location) => ({
        locationId: location.locationId,
        name: location.name,
      }));
    return { items };
  }
}
