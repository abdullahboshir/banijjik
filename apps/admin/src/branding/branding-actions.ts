import { ERROR_CODE } from "@banijjik/contracts";
import { FILE_PURPOSE } from "@banijjik/contracts/file";
import { publicFileUrl, uploadFile } from "@banijjik/web-client";
import { knownMessageKeyOrInternal, type FieldErrors } from "../auth/field-errors";
import { API_BASE_URL } from "../config/api-base-url";
import { apiFetch } from "../lib/api/api-client";
import { ApiError } from "../lib/api/api-error";
import { updateProfile } from "../profile/profile-api";
import { failureOfApiError, type FormFailure } from "../settings/form-failure";
import { buildBrandingUpdate, type BrandingFormState } from "./branding-state";

/**
 * What the branding form does on a click: upload a logo, save. It lives apart from the form and the
 * form loads it on the first click, so the error mapping and the API calls stay out of the first
 * scripts of the page (13-UX section 11).
 */

const PATH_PREFIX = "branding.";
const PREVIEW_VARIANT = "medium";

export type LogoUploadOutcome =
  { ok: true; fileId: string; previewUrl: string } | { ok: false; errorKey: string };

export async function uploadLogo(organizationId: string, file: File): Promise<LogoUploadOutcome> {
  try {
    const uploaded = await uploadFile(apiFetch, {
      organizationId,
      purpose: FILE_PURPOSE.LOGO,
      file,
    });
    const previewUrl = publicFileUrl(API_BASE_URL, uploaded.fileId, PREVIEW_VARIANT);
    return { ok: true, fileId: uploaded.fileId, previewUrl };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { ok: false, errorKey: knownMessageKeyOrInternal(error.messageKey) };
  }
}

/** The API names a refused branding key `branding.<key>`; the form places it on that key's box. */
function brandingFieldErrors(error: ApiError): FieldErrors {
  const fields: unknown = error.details?.["fields"];
  if (!Array.isArray(fields)) return {};
  const errors: FieldErrors = {};
  for (const field of fields) {
    // The API sends `fields` as untyped JSON; only entries with two strings are used.
    const { path, messageKey } = field as { path?: unknown; messageKey?: unknown };
    if (typeof path !== "string" || typeof messageKey !== "string") continue;
    if (path.startsWith(PATH_PREFIX)) {
      errors[path.slice(PATH_PREFIX.length)] ??= knownMessageKeyOrInternal(messageKey);
    }
  }
  return errors;
}

export interface SaveBrandingInput {
  organizationId: string;
  version: number;
  initial: BrandingFormState;
  current: BrandingFormState;
}

export type SaveBrandingOutcome =
  | { kind: "nothing-to-save" }
  | { kind: "saved" }
  | { kind: "refused"; errors: FieldErrors; failure: FormFailure | undefined };

/** Saves what changed. A colour the API would refuse is caught first, with the same helper as the API. */
export async function saveBranding(input: SaveBrandingInput): Promise<SaveBrandingOutcome> {
  const built = buildBrandingUpdate(input.current, input.initial);
  if (!built.ok) return { kind: "refused", errors: built.fieldErrors, failure: undefined };
  if (built.branding === undefined) return { kind: "nothing-to-save" };
  try {
    await updateProfile(input.organizationId, { version: input.version, branding: built.branding });
    return { kind: "saved" };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    const placed = error.code === ERROR_CODE.VALIDATION_ERROR ? brandingFieldErrors(error) : {};
    const hasPlaced = Object.keys(placed).length > 0;
    return {
      kind: "refused",
      errors: placed,
      failure: hasPlaced ? undefined : failureOfApiError(error, []),
    };
  }
}
