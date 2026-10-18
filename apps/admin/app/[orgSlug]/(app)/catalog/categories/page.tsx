import type { ReactElement } from "react";
import { CategoriesPage } from "../../../../../src/catalog/categories-page";

export default async function CatalogCategoriesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const { orgSlug } = await params;
  return <CategoriesPage orgSlug={orgSlug} />;
}
