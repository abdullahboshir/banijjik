import { PackageAdminSupport } from "./package-admin-support.js";
import type { PackageDetail } from "./package-detail.js";

export class GetPackageUseCase extends PackageAdminSupport {
  async execute(input: { readonly packageId: string }): Promise<PackageDetail> {
    return this.detailOf(await this.requirePackage(input.packageId));
  }
}
