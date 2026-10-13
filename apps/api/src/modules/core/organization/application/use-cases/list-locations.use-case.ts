import { type LocationStatus } from "@banijjik/contracts";
import { Location } from "../../domain/location.entity.js";
import type { LocationManagementRepository } from "../ports/location-management-repository.js";
import type { Page, PageRequest } from "../ports/page.js";

export interface ListLocationsInput extends PageRequest {
  readonly status?: LocationStatus;
  readonly visibleLocationIds: readonly string[] | "ALL";
}

/** One page of locations. A caller limited to some locations sees only those (plan 1.7b decision 5). */
export class ListLocationsUseCase {
  constructor(private readonly locations: LocationManagementRepository) {}

  execute(input: ListLocationsInput): Promise<Page<Location>> {
    return this.locations.list(input);
  }
}
