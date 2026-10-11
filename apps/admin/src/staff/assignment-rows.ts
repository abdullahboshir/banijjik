import { ALL_LOCATIONS, type AssignmentRequest } from "@banijjik/contracts";

export interface AssignmentRow {
  roleId: string;
  /** A location ID, "ALL", or "" while nothing is chosen. */
  locationId: string;
}

/** Message keys per row; the duplicate message belongs to the screens, so it has a key of its own. */
export interface RowErrors {
  roleId?: string;
  locationId?: string;
}

export const DUPLICATE_ROW_KEY = "staff.assignment.duplicate";
const REQUIRED_KEY = "validation.required";

export function emptyRow(isSingleLocation: boolean): AssignmentRow {
  return { roleId: "", locationId: isSingleLocation ? ALL_LOCATIONS : "" };
}

/** Rows to send: in a one-location business the location is always "ALL". */
export function toAssignmentRequests(
  rows: readonly AssignmentRow[],
  isSingleLocation: boolean,
): AssignmentRequest[] {
  return rows.map((row) => ({
    roleId: row.roleId,
    locationId: isSingleLocation ? ALL_LOCATIONS : row.locationId,
  }));
}

/** Rows from a member's saved assignments. */
export function toRows(assignments: readonly AssignmentRequest[]): AssignmentRow[] {
  return assignments.map(({ roleId, locationId }) => ({ roleId, locationId }));
}

/** Mistakes the form can see without asking the server: a missing role or location, the same pair twice. */
export function validateRows(
  rows: readonly AssignmentRow[],
  isSingleLocation: boolean,
): Record<number, RowErrors> {
  const errors: Record<number, RowErrors> = {};
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const rowErrors: RowErrors = {};
    if (row.roleId === "") rowErrors.roleId = REQUIRED_KEY;
    if (!isSingleLocation && row.locationId === "") rowErrors.locationId = REQUIRED_KEY;
    const pair = `${row.roleId}|${isSingleLocation ? ALL_LOCATIONS : row.locationId}`;
    if (row.roleId !== "" && seen.has(pair)) rowErrors.roleId = DUPLICATE_ROW_KEY;
    seen.add(pair);
    if (Object.keys(rowErrors).length > 0) errors[index] = rowErrors;
  });
  return errors;
}
