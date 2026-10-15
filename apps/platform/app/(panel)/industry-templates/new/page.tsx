import type { ReactElement } from "react";
import { NewIndustryPage } from "../../../../src/industry-templates/new-industry-page";

export default async function NewIndustryRoute(): Promise<ReactElement> {
  return <NewIndustryPage />;
}
