import {
  LIMIT_KEY_VALUES,
  type LimitKey,
  type ModuleKey,
  type PlatformPackageResponse,
} from "@banijjik/contracts";

/** One limit as typed: a count, or "unlimited" (stored as `null` in the package). */
export interface LimitDraft {
  isUnlimited: boolean;
  value: string;
}

/** The form's state for a package; numbers stay text until they are checked, so an empty field is not zero. */
export interface PackageDraft {
  packageKey: string;
  name: string;
  isAddOn: boolean;
  moduleKeys: ModuleKey[];
  limits: Record<LimitKey, LimitDraft>;
  increments: Record<LimitKey, string>;
}

function emptyRecord<Value>(make: () => Value): Record<LimitKey, Value> {
  // Safe: the object is filled with every limit key on the next line, so no key is missing.
  const record = {} as Record<LimitKey, Value>;
  for (const limitKey of LIMIT_KEY_VALUES) record[limitKey] = make();
  return record;
}

/** The empty draft of a new package. */
export function newDraft(): PackageDraft {
  return {
    packageKey: "",
    name: "",
    isAddOn: false,
    moduleKeys: [],
    limits: emptyRecord(() => ({ isUnlimited: false, value: "" })),
    increments: emptyRecord(() => ""),
  };
}

/** The draft of an existing package. */
export function draftOf(pkg: PlatformPackageResponse): PackageDraft {
  const draft = newDraft();
  for (const limitKey of LIMIT_KEY_VALUES) {
    const limit = pkg.limits[limitKey];
    draft.limits[limitKey] = {
      isUnlimited: limit === null,
      value: limit === null ? "" : String(limit),
    };
    draft.increments[limitKey] = String(pkg.limitIncrements[limitKey] ?? "");
  }
  return {
    ...draft,
    packageKey: pkg.packageKey,
    name: pkg.name ?? "",
    isAddOn: pkg.isAddOn,
    moduleKeys: [...pkg.moduleKeys],
  };
}

/** A typed count, or undefined when the field is empty or not a number (the schema then reports it). */
function countOf(text: string): number | undefined {
  if (text.trim() === "") return undefined;
  const count = Number(text);
  return Number.isFinite(count) ? count : undefined;
}

/** The `limits` object as the API expects it; an unreadable value stays `undefined` for the schema to refuse. */
export function limitsOf(draft: PackageDraft): Record<string, number | null | undefined> {
  return Object.fromEntries(
    LIMIT_KEY_VALUES.map((limitKey) => {
      const limit = draft.limits[limitKey];
      return [limitKey, limit.isUnlimited ? null : countOf(limit.value)];
    }),
  );
}

/** The filled increments of an add-on; empty fields are left out. */
export function incrementsOf(draft: PackageDraft): Record<string, number | undefined> {
  const entries = LIMIT_KEY_VALUES.map((limitKey) => [
    limitKey,
    countOf(draft.increments[limitKey]),
  ]);
  return Object.fromEntries(entries.filter(([, count]) => count !== undefined));
}

/** The modules with `moduleKey` switched on or off, keeping the order they were chosen in. */
export function withModule(
  moduleKeys: readonly ModuleKey[],
  moduleKey: ModuleKey,
  isChecked: boolean,
): ModuleKey[] {
  const others = moduleKeys.filter((key) => key !== moduleKey);
  return isChecked ? [...others, moduleKey] : others;
}
