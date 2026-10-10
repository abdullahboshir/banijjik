import type { ReactElement } from "react";
import { loadSessionData } from "../src/auth/session-data";
import { BusinessHome } from "../src/orgs/business-home";

export default async function RootPage(): Promise<ReactElement> {
  const { me, organizations } = await loadSessionData();
  return <BusinessHome me={me} organizations={organizations} />;
}
