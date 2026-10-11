import type {
  LimitKey,
  PlatformPackageCreateRequest,
  PlatformPackageUpdateRequest,
} from "@banijjik/contracts";
import { LIMIT_KEY_VALUES } from "@banijjik/contracts";
import { issuesToFieldErrors, type FieldErrors } from "../forms/schema-errors";
import { incrementsOf, limitsOf, type PackageDraft } from "./package-draft";

export type PackageRequestResult<Request> =
  { isValid: true; request: Request } | { isValid: false; errors: FieldErrors };

type Increments = Partial<Record<LimitKey, number>>;

/** The schema marks absent keys as possibly `undefined`; the request type wants them absent. */
function presentIncrements(
  increments: Partial<Record<LimitKey, number | undefined>> | undefined,
): { limitIncrements: Increments } | Record<string, never> {
  if (increments === undefined) return {};
  const present: Increments = {};
  for (const limitKey of LIMIT_KEY_VALUES) {
    const increment = increments[limitKey];
    if (increment !== undefined) present[limitKey] = increment;
  }
  return { limitIncrements: present };
}

function withIncrements<Body extends object>(body: Body, draft: PackageDraft): Body {
  const increments = incrementsOf(draft);
  return draft.isAddOn && Object.keys(increments).length > 0
    ? { ...body, limitIncrements: increments }
    : body;
}

/**
 * Checks the draft of a new package against the schema of the API and builds the request. The schemas load on
 * demand, so the library behind them is not part of the first load of the form page.
 */
export async function buildCreateRequest(
  draft: PackageDraft,
): Promise<PackageRequestResult<PlatformPackageCreateRequest>> {
  const { platformPackageCreateRequestSchema } = await import("@banijjik/validation");
  const candidate = withIncrements(
    {
      packageKey: draft.packageKey.trim(),
      name: draft.name,
      isAddOn: draft.isAddOn,
      moduleKeys: draft.moduleKeys,
      limits: limitsOf(draft),
    },
    draft,
  );
  const parsed = platformPackageCreateRequestSchema.safeParse(candidate);
  if (!parsed.success) {
    return { isValid: false, errors: issuesToFieldErrors(parsed.error.issues, candidate) };
  }
  const { packageKey, name, isAddOn, moduleKeys, limits, limitIncrements } = parsed.data;
  return {
    isValid: true,
    request: {
      packageKey,
      name,
      isAddOn,
      moduleKeys,
      limits,
      ...presentIncrements(limitIncrements),
    },
  };
}

export interface UpdateOptions {
  version: number;
  /** Only an operator-made package has a name an operator may change. */
  canRename: boolean;
}

/** Like `buildCreateRequest`, for the edit form. The name is sent only for an operator-made package. */
export async function buildUpdateRequest(
  draft: PackageDraft,
  options: UpdateOptions,
): Promise<PackageRequestResult<PlatformPackageUpdateRequest>> {
  const { platformPackageUpdateRequestSchema } = await import("@banijjik/validation");
  const candidate = withIncrements(
    {
      version: options.version,
      ...(options.canRename ? { name: draft.name } : {}),
      moduleKeys: draft.moduleKeys,
      limits: limitsOf(draft),
    },
    draft,
  );
  const parsed = platformPackageUpdateRequestSchema.safeParse(candidate);
  if (!parsed.success) {
    return { isValid: false, errors: issuesToFieldErrors(parsed.error.issues, candidate) };
  }
  const { version, name, moduleKeys, limits, limitIncrements } = parsed.data;
  return {
    isValid: true,
    request: {
      version,
      ...(name === undefined ? {} : { name }),
      ...(moduleKeys === undefined ? {} : { moduleKeys }),
      ...(limits === undefined ? {} : { limits }),
      ...presentIncrements(limitIncrements),
    },
  };
}
