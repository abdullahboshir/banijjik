import type { ReactElement } from "react";
import { IndustryTemplatesPage } from "../../../src/industry-templates/industry-templates-page";

export default async function IndustryTemplatesRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  return <IndustryTemplatesPage searchParams={await searchParams} />;
}
