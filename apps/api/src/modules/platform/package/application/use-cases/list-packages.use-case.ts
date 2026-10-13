import type { PackageListQuery } from "../ports/package-repository.js";
import { PackageAdminSupport } from "./package-admin-support.js";
import type { PackagePageDetail } from "./package-page-detail.js";

export class ListPackagesUseCase extends PackageAdminSupport {
  async execute(query: PackageListQuery): Promise<PackagePageDetail> {
    const page = await this.dependencies.packages.list(query);
    return { items: page.items.map((entry) => this.detailOf(entry)), hasNext: page.hasNext };
  }
}
