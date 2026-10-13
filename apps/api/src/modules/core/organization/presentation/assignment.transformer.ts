import type { AssignmentRequest } from "@banijjik/contracts";
import { ALL_LOCATIONS } from "@banijjik/contracts";
import { asId, type LocationId, type RoleId } from "@banijjik/ids";
import type { Assignment } from "../domain/member.entity.js";

/** The assignments of a validated body as domain values. The schema already checked every ID. */
export function toAssignments(assignments: readonly AssignmentRequest[]): Assignment[] {
  return assignments.map(({ locationId, roleId }) => ({
    locationId: locationId === ALL_LOCATIONS ? ALL_LOCATIONS : asId<LocationId>(locationId),
    roleId: asId<RoleId>(roleId),
  }));
}

export function toAssignmentResponses(assignments: readonly Assignment[]): AssignmentRequest[] {
  return assignments.map(({ locationId, roleId }) => ({ locationId, roleId }));
}
