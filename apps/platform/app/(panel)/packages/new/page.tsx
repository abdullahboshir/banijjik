import type { ReactElement } from "react";
import { PackageFormPage } from "../../../../src/packages/package-form-page";

export default function NewPackageRoute(): Promise<ReactElement> {
  return PackageFormPage({ packageId: undefined });
}
