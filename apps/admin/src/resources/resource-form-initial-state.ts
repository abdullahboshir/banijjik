import type { ResourceResponse } from "@banijjik/contracts/booking";
import { emptyResourceForm, type ResourceFormState } from "./resource-form";
import { rowsFromSchedule } from "./resource-schedule";

export function initialResourceForm(input: {
  locationId: string;
  resourceTypeKey: string;
  existing?: ResourceResponse;
}): ResourceFormState {
  if (input.existing === undefined) {
    return emptyResourceForm({
      locationId: input.locationId,
      resourceTypeKey: input.resourceTypeKey,
    });
  }
  return {
    locationId: input.existing.locationId,
    resourceTypeKey: input.existing.resourceTypeKey,
    name: input.existing.name,
    capacity: String(input.existing.capacity),
    offeringIds: input.existing.offeringIds,
    scheduleRows: rowsFromSchedule(input.existing.weeklySchedule),
    timeOffStartsAt: "",
    timeOffEndsAt: "",
    timeOffReason: "",
  };
}
