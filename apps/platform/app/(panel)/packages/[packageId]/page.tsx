import type { ReactElement } from "react";
import { PackageFormPage } from "../../../../src/packages/package-form-page";

export default async function PackageRoute({
  params,
}: {
  params: Promise<{ packageId: string }>;
}): Promise<ReactElement> {
  const { packageId } = await params;
  return <PackageFormPage packageId={packageId} />;
}
