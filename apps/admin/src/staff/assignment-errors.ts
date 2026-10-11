import { ERROR_CODE, ORGANIZATION_RULE_KEY } from "@banijjik/contracts";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import type { AssignmentRow, RowErrors } from "./assignment-rows";

const ROW_PATH = /^assignments\.(\d+)\.(roleId|locationId)$/;

export interface AssignmentFailure {
  rowErrors: Record<number, RowErrors>;
  /** True when the API refused because someone else changed the member (409 CONFLICT). */
  isConflict: boolean;
  /** An error that belongs to no row, to be shown under the form. */
  formMessageKey?: string;
}

function rowErrorsFromFields(details: ApiError["details"]): Record<number, RowErrors> {
  const fields: unknown = details?.["fields"];
  const rowErrors: Record<number, RowErrors> = {};
  if (!Array.isArray(fields)) return rowErrors;
  for (const field of fields as { path?: unknown; messageKey?: unknown }[]) {
    if (typeof field.path !== "string" || typeof field.messageKey !== "string") continue;
    const match = ROW_PATH.exec(field.path);
    if (!match) continue;
    const index = Number(match[1]);
    const key = match[2] as keyof RowErrors;
    rowErrors[index] = { ...rowErrors[index], [key]: knownMessageKeyOrInternal(field.messageKey) };
  }
  return rowErrors;
}

/** The role named by a ROLE_NOT_GRANTABLE refusal gets the message on every row that uses it. */
function rowErrorsFromRoleRefusal(
  error: ApiError,
  rows: readonly AssignmentRow[],
): Record<number, RowErrors> {
  const roleId = error.details?.["roleId"];
  const rowErrors: Record<number, RowErrors> = {};
  rows.forEach((row, index) => {
    if (row.roleId === roleId) rowErrors[index] = { roleId: "errors.role_not_grantable" };
  });
  return rowErrors;
}

/** Places an API refusal of an assignment change on the rows it is about. */
export function failureOfAssignmentError(
  error: ApiError,
  rows: readonly AssignmentRow[],
): AssignmentFailure {
  if (error.code === ERROR_CODE.CONFLICT) return { rowErrors: {}, isConflict: true };
  const isRoleRefusal =
    error.code === ERROR_CODE.BUSINESS_RULE &&
    error.details?.["ruleKey"] === ORGANIZATION_RULE_KEY.ROLE_NOT_GRANTABLE;
  const rowErrors = isRoleRefusal
    ? rowErrorsFromRoleRefusal(error, rows)
    : rowErrorsFromFields(error.details);
  if (Object.keys(rowErrors).length > 0) return { rowErrors, isConflict: false };
  return {
    rowErrors,
    isConflict: false,
    formMessageKey: knownMessageKeyOrInternal(error.messageKey),
  };
}
