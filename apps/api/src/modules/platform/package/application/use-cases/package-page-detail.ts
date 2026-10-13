import type { PackageDetail } from "./package-detail.js";

export interface PackagePageDetail {
  readonly items: readonly PackageDetail[];
  readonly hasNext: boolean;
}
