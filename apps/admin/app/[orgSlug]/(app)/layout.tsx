import type { ReactElement, ReactNode } from "react";
import { loadOrgContext } from "../../../src/shell/org-access";
import { OrganizationShell } from "../../../src/shell/organization-shell";

export default async function OrganizationShellLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const { orgSlug } = await params;
  // The business id comes from /me/orgs, so the config call cannot run in parallel with it.
  const { me, organizations, config, timeZone } = await loadOrgContext(orgSlug);
  return (
    <OrganizationShell
      orgSlug={orgSlug}
      me={me}
      organizations={organizations}
      config={config}
      timeZone={timeZone}
    >
      {children}
    </OrganizationShell>
  );
}
