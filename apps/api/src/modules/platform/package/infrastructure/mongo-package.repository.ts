import { PACKAGE_STATUS } from "@banijjik/contracts";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { PackageVersionStamp, PackageView } from "../application/package-view.js";
import type { PackageReader, PackageRepository } from "../application/ports/package-repository.js";
import type { Package } from "../domain/package.entity.js";
import { toPackageDocument, toPackageView, toVersionStamp } from "./package.mapper.js";
import { PACKAGE_MODEL_NAME, type PackageDocument } from "./package.schema.js";

/** Packages are platform data (tenancy NONE): the same rows serve every organization. */
export class MongoPackageRepository implements PackageRepository, PackageReader {
  async insert(newPackage: Package): Promise<void> {
    await this.model().create([toPackageDocument(newPackage)], sessionOption(getActiveSession()));
  }

  async findExistingKeys(packageKeys: readonly string[]): Promise<ReadonlySet<string>> {
    const rows = await this.model()
      .find({ packageKey: { $in: packageKeys } }, { packageKey: 1, _id: 0 })
      .lean<Pick<PackageDocument, "packageKey">[]>();
    return new Set(rows.map((row) => row.packageKey));
  }

  async findByIds(packageIds: readonly string[]): Promise<readonly PackageView[]> {
    if (packageIds.length === 0) return [];
    const rows = await this.model()
      .find({ packageId: { $in: packageIds } }, null, sessionOption(getActiveSession()))
      .lean<PackageDocument[]>();
    return rows.map(toPackageView);
  }

  async findActiveBaseByKey(packageKey: string): Promise<PackageView | undefined> {
    const row = await this.model()
      .findOne(
        { packageKey, isAddOn: false, status: PACKAGE_STATUS.ACTIVE },
        null,
        sessionOption(getActiveSession()),
      )
      .lean<PackageDocument>();
    return row === null ? undefined : toPackageView(row);
  }

  async listActiveVersions(): Promise<readonly PackageVersionStamp[]> {
    const rows = await this.model()
      .find({ status: PACKAGE_STATUS.ACTIVE }, { packageId: 1, version: 1, _id: 0 })
      .lean<Pick<PackageDocument, "packageId" | "version">[]>();
    return rows.map(toVersionStamp);
  }

  private model() {
    return models({}).get<PackageDocument>(PACKAGE_MODEL_NAME);
  }
}
