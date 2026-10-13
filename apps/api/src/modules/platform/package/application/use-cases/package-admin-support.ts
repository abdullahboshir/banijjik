import { packageNotClosed, packageNotFound } from "../../domain/errors.js";
import { findClosureGaps, findUnbuiltModuleKeys } from "../../domain/package-closure.js";
import { Package } from "../../domain/package.entity.js";
import type { PackageAdminDependencies } from "./package-admin-dependencies.js";
import type { PackageDetail } from "./package-detail.js";

export class PackageAdminSupport {
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
