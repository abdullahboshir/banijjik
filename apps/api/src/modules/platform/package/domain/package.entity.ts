import {
  isModuleKey,
  LIMIT_KEY_VALUES,
  PACKAGE_STATUS,
  type LimitKey,
  type LimitMap,
  type LimitValue,
  type ModuleKey,
  type PackageStatus,
} from "@banijjik/contracts";
import { newId, type PackageId } from "@banijjik/ids";
import { invalidPackageField } from "./errors.js";

const PACKAGE_KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const INITIAL_VERSION = 1;

export type LimitIncrements = Readonly<Partial<Record<LimitKey, number>>>;

export interface PackageProps {
  readonly packageId: PackageId;
  readonly packageKey: string;
  readonly nameKey: string;
  readonly isAddOn: boolean;
  readonly moduleKeys: readonly ModuleKey[];
  /** `null` is unlimited. Meaningful for base packages; an add-on adds through `limitIncrements`. */
  readonly limits: LimitMap;
  readonly limitIncrements: LimitIncrements;
  readonly status: PackageStatus;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewPackageInput {
  readonly packageKey: string;
  readonly nameKey: string;
  readonly isAddOn: boolean;
  readonly moduleKeys: readonly string[];
  readonly limits: LimitMap;
  readonly limitIncrements: LimitIncrements;
  readonly now: Date;
}

function isCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function assertModuleKeysAreCatalogued(moduleKeys: readonly string[]): readonly ModuleKey[] {
  const known = moduleKeys.filter(isModuleKey);
  if (known.length !== moduleKeys.length) {
    throw invalidPackageField("moduleKeys", "validation.invalid_value");
  }
  if (new Set(known).size !== known.length) {
    throw invalidPackageField("moduleKeys", "validation.invalid_value");
  }
  return known;
}

function assertLimitsAreCounts(limits: LimitMap): void {
  for (const limitKey of LIMIT_KEY_VALUES) {
    const value: LimitValue | undefined = limits[limitKey];
    if (value === undefined || (value !== null && !isCount(value))) {
      throw invalidPackageField(`limits.${limitKey}`, "validation.invalid_value");
    }
  }
}

function assertIncrementsFitTheKind(isAddOn: boolean, increments: LimitIncrements): void {
  const values = Object.values(increments);
  if (!values.every(isCount))
    throw invalidPackageField("limitIncrements", "validation.invalid_value");
  // A base package sets limits; only an add-on adds to them (09 section 4.6).
  if (!isAddOn && values.length > 0) {
    throw invalidPackageField("limitIncrements", "validation.invalid_value");
  }
}

/**
 * A sellable bundle of modules and limits (09 section 4.6). Module keys are checked against the
 * catalogue (`MODULE_KEY`), not against the registered manifests: seed packages name modules that
 * later phases build, and the resolver ignores keys without a manifest.
 */
export class Package implements PackageProps {
  readonly packageId: PackageId;
  readonly packageKey: string;
  readonly nameKey: string;
  readonly isAddOn: boolean;
  readonly moduleKeys: readonly ModuleKey[];
  readonly limits: LimitMap;
  readonly limitIncrements: LimitIncrements;
  readonly status: PackageStatus;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: PackageProps) {
    this.packageId = props.packageId;
    this.packageKey = props.packageKey;
    this.nameKey = props.nameKey;
    this.isAddOn = props.isAddOn;
    this.moduleKeys = props.moduleKeys;
    this.limits = props.limits;
    this.limitIncrements = props.limitIncrements;
    this.status = props.status;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input: NewPackageInput): Package {
    if (!PACKAGE_KEY_PATTERN.test(input.packageKey)) {
      throw invalidPackageField("packageKey", "validation.invalid_format");
    }
    const moduleKeys = assertModuleKeysAreCatalogued(input.moduleKeys);
    assertLimitsAreCounts(input.limits);
    assertIncrementsFitTheKind(input.isAddOn, input.limitIncrements);
    return new Package({
      packageId: newId<PackageId>(),
      packageKey: input.packageKey,
      nameKey: input.nameKey,
      isAddOn: input.isAddOn,
      moduleKeys,
      limits: input.limits,
      limitIncrements: input.limitIncrements,
      status: PACKAGE_STATUS.ACTIVE,
      version: INITIAL_VERSION,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  /** Rebuilds a stored package. The data was validated when it was written. */
  static restore(props: PackageProps): Package {
    return new Package(props);
  }
}
