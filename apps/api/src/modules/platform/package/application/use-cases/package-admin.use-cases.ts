import {
  PLATFORM_AUDIT_ACTION,
  PLATFORM_AUDIT_TARGET_TYPE,
  SYSTEM_REASON,
  LIMIT_KEY_VALUES,
  type LimitMap,
  type ModuleKey,
} from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
import { diffAuditFields, type AuditFields } from "../../../../../kernel/audit/index.js";
import type { PlatformAuditRecorder } from "../../../../../kernel/audit/index.js";
import { runAsSystem } from "../../../../../kernel/context/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { packageInUse, packageNotClosed, packageNotFound } from "../../domain/errors.js";
import { findClosureGaps, findUnbuiltModuleKeys } from "../../domain/package-closure.js";
import { Package, type LimitIncrements } from "../../domain/package.entity.js";
import type {
  ManifestCatalog,
  PackageAdminRepository,
  PackageListQuery,
  PackageUsage,
} from "../ports/package-repository.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export interface PackageAdminDependencies {
  readonly packages: PackageAdminRepository;
  readonly manifests: ManifestCatalog;
  readonly usage: PackageUsage;
  readonly unitOfWork: UnitOfWork;
  readonly platformAudit: PlatformAuditRecorder;
  readonly clock: Clock;
}

/** A package with the module keys that have no manifest yet, so the panel can show what is not built. */
export interface PackageDetail {
  readonly package: Package;
  readonly unbuiltModuleKeys: readonly ModuleKey[];
}

export interface PackagePageDetail {
  readonly items: readonly PackageDetail[];
  readonly hasNext: boolean;
}

function auditFieldsOf(subject: Package): AuditFields {
  const fields: Record<string, AuditFields[string]> = {
    packageKey: subject.packageKey,
    name: subject.name,
    isAddOn: subject.isAddOn,
    status: subject.status,
    moduleKeys: [...subject.moduleKeys],
  };
  for (const limitKey of LIMIT_KEY_VALUES) {
    fields[`limits.${limitKey}`] = subject.limits[limitKey];
    const increment = subject.limitIncrements[limitKey];
    if (increment !== undefined) fields[`limitIncrements.${limitKey}`] = increment;
  }
  return fields;
}

class PackageAdminSupport {
  constructor(protected readonly dependencies: PackageAdminDependencies) {}

  protected detailOf(subject: Package): PackageDetail {
    const manifests = this.dependencies.manifests.all();
    return {
      package: subject,
      unbuiltModuleKeys: findUnbuiltModuleKeys(subject.moduleKeys, manifests),
    };
  }

  /** The closure rule applies to base packages; an add-on is only a bundle on top of one. */
  protected assertClosed(subject: Package): void {
    if (subject.isAddOn) return;
    const gaps = findClosureGaps(subject.moduleKeys, this.dependencies.manifests.all());
    if (gaps.length > 0) throw packageNotClosed(gaps);
  }

  protected async requirePackage(packageId: string): Promise<Package> {
    const found = await this.dependencies.packages.findById(packageId);
    if (found === undefined) throw packageNotFound();
    return found;
  }
}

export class ListPackagesUseCase extends PackageAdminSupport {
  async execute(query: PackageListQuery): Promise<PackagePageDetail> {
    const page = await this.dependencies.packages.list(query);
    return { items: page.items.map((entry) => this.detailOf(entry)), hasNext: page.hasNext };
  }
}

export class GetPackageUseCase extends PackageAdminSupport {
  async execute(input: { readonly packageId: string }): Promise<PackageDetail> {
    return this.detailOf(await this.requirePackage(input.packageId));
  }
}

export interface CreatePackageInput {
  readonly actorUserId: UserId;
  readonly packageKey: string;
  readonly name: string;
  readonly isAddOn: boolean;
  readonly moduleKeys: readonly string[];
  readonly limits: LimitMap;
  readonly limitIncrements: LimitIncrements;
}

/** Creates a package. A base package must be closed under `dependsOn` (10 section 3). */
export class CreatePackageUseCase extends PackageAdminSupport {
  async execute(input: CreatePackageInput): Promise<PackageDetail> {
    const { packages, unitOfWork, platformAudit, clock } = this.dependencies;
    const created = Package.create({
      packageKey: input.packageKey,
      name: input.name,
      isAddOn: input.isAddOn,
      moduleKeys: input.moduleKeys,
      limits: input.limits,
      limitIncrements: input.limitIncrements,
      now: clock.now(),
    });
    this.assertClosed(created);
    await unitOfWork.run(async () => {
      await packages.insert(created, input.actorUserId);
      await platformAudit.record({
        action: PLATFORM_AUDIT_ACTION.PACKAGE_CREATED,
        targetType: PLATFORM_AUDIT_TARGET_TYPE.package,
        targetId: created.packageId,
        changes: diffAuditFields({}, auditFieldsOf(created)),
      });
    });
    return this.detailOf(created);
  }
}

export interface UpdatePackageInput {
  readonly actorUserId: UserId;
  readonly packageId: string;
  readonly version: number;
  readonly name?: string;
  readonly moduleKeys?: readonly string[];
  readonly limits?: LimitMap;
  readonly limitIncrements?: LimitIncrements;
}

/**
 * Edits the modules and limits of a package. Every save moves `Package.version`, so the package
 * catalogue version of the resolver picks the edit up within its 5 s refresh (ADR-091).
 */
export class UpdatePackageUseCase extends PackageAdminSupport {
  async execute(input: UpdatePackageInput): Promise<PackageDetail> {
    const { packages, unitOfWork, platformAudit } = this.dependencies;
    const existing = await this.requirePackage(input.packageId);
    const edited = existing.withChanges({
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.moduleKeys === undefined ? {} : { moduleKeys: input.moduleKeys }),
      ...(input.limits === undefined ? {} : { limits: input.limits }),
      ...(input.limitIncrements === undefined ? {} : { limitIncrements: input.limitIncrements }),
    });
    this.assertClosed(edited);
    const saved = await unitOfWork.run(async () => {
      const result = await packages.update(edited, input.version, input.actorUserId);
      await platformAudit.record({
        action: PLATFORM_AUDIT_ACTION.PACKAGE_UPDATED,
        targetType: PLATFORM_AUDIT_TARGET_TYPE.package,
        targetId: result.packageId,
        changes: diffAuditFields(auditFieldsOf(existing), auditFieldsOf(result)),
      });
      return result;
    });
    return this.detailOf(saved);
  }
}

export interface ArchivePackageInput {
  readonly actorUserId: UserId;
  readonly packageId: string;
  readonly version: number;
}

/** Takes a package out of sale. A package that a running subscription uses cannot be archived. */
export class ArchivePackageUseCase extends PackageAdminSupport {
  async execute(input: ArchivePackageInput): Promise<PackageDetail> {
    const { packages, usage, unitOfWork, platformAudit } = this.dependencies;
    const existing = await this.requirePackage(input.packageId);
    const archived = existing.archived();
    const saved = await unitOfWork.run(async () => {
      // The usage check runs inside the transaction: archive writes the package document, and so does
      // change-package (the guard counter), so a concurrent pair conflicts and the retry checks again (ADR-093).
      // Subscriptions are tenant data: this read is the one system access of the platform package module.
      const isInUse = await runAsSystem(SYSTEM_REASON.PLATFORM_ADMIN, () =>
        usage.isInUse(input.packageId),
      );
      if (isInUse) throw packageInUse();
      const result = await packages.update(archived, input.version, input.actorUserId);
      await platformAudit.record({
        action: PLATFORM_AUDIT_ACTION.PACKAGE_ARCHIVED,
        targetType: PLATFORM_AUDIT_TARGET_TYPE.package,
        targetId: result.packageId,
        changes: diffAuditFields({ status: existing.status }, { status: result.status }),
      });
      return result;
    });
    return this.detailOf(saved);
  }
}
