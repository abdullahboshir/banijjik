import type { ReactElement, ReactNode } from "react";
import { loadSessionData } from "../../../src/auth/session-data";
import { OrganizationShell } from "../../../src/shell/organization-shell";

export default async function OrganizationShellLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const [{ orgSlug }, { me, organizations }] = await Promise.all([params, loadSessionData()]);
  return (
    <OrganizationShell orgSlug={orgSlug} me={me} organizations={organizations}>
      {children}
    </OrganizationShell>
  );
}
