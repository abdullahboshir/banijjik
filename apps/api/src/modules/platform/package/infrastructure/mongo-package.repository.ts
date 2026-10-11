import { PACKAGE_STATUS } from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
import {
  getActiveSession,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type { PackageVersionStamp, PackageView } from "../application/package-view.js";
import type {
  PackageAdminRepository,
  PackageListQuery,
  PackagePage,
  PackageReader,
  PackageRepository,
} from "../application/ports/package-repository.js";
import type { Package } from "../domain/package.entity.js";
import { toDuplicatePackageKeyError } from "./duplicate-package-key.js";
import { toPackage, toPackageDocument, toPackageView, toVersionStamp } from "./package.mapper.js";
import { PACKAGE_MODEL_NAME, type PackageDocument } from "./package.schema.js";

/** Packages are platform data (tenancy NONE): the same rows serve every organization. */
export class MongoPackageRepository
  implements PackageRepository, PackageReader, PackageAdminRepository
{
  async insert(newPackage: Package, actorUserId?: UserId): Promise<void> {
    try {
      await this.model().create(
        [toPackageDocument(newPackage, actorUserId)],
        sessionOption(getActiveSession()),
      );
    } catch (error) {
      throw toDuplicatePackageKeyError(error);
    }
  }

  async findById(packageId: string): Promise<Package | undefined> {
    const row = await this.model()
      .findOne({ packageId }, null, sessionOption(getActiveSession()))
      .lean<PackageDocument>();
    return row === null ? undefined : toPackage(row);
  }

  async list(query: PackageListQuery): Promise<PackagePage> {
    // One extra row tells whether another page exists, without counting the collection.
    const rows = await this.model()
      .find(query.status === undefined ? {} : { status: query.status })
      .sort({ packageKey: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit + 1)
      .lean<PackageDocument[]>();
    return { items: rows.slice(0, query.limit).map(toPackage), hasNext: rows.length > query.limit };
  }

  async update(updated: Package, expectedVersion: number, actorUserId: UserId): Promise<Package> {
    const saved = await updateVersioned<PackageDocument>({
      model: this.model(),
      filter: { packageId: updated.packageId },
      expectedVersion,
      update: {
        $set: {
          moduleKeys: [...updated.moduleKeys],
          limits: { ...updated.limits },
          limitIncrements: { ...updated.limitIncrements },
          status: updated.status,
          updatedByUserId: actorUserId,
        },
      },
    });
    return toPackage(saved);
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
