import {
  ORGANIZATION_STATUS,
  type MeResponse,
  type MyOrganizationSummary,
} from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { AppShell, EmptyState, Sidebar, TopBar, type SidebarGroup } from "@banijjik/ui";
import { notFound } from "next/navigation";
import type { ReactElement, ReactNode } from "react";
import { getTranslator } from "../lib/i18n/get-translator";
import { AccountMenuContainer } from "./account-menu-container";
import { BrandLogo } from "./brand-logo";
import { ShellNavigation } from "./shell-navigation";

// Until /me/config is wired (card 1.7c) the menu and the create actions are empty.
function MobileNavigation({ orgSlug, t }: { orgSlug: string; t: Translator["t"] }): ReactElement {
  return (
    <ShellNavigation
      menu={[]}
      orgSlug={orgSlug}
      quickCreateActions={[]}
      labels={{
        navLabel: t("nav.bottom"),
        home: t("nav.home"),
        quickCreate: t("nav.quickCreate"),
        more: t("nav.more"),
        closeLabel: t("shell.closeMenu"),
        emptyText: t("state.empty.default"),
      }}
    />
  );
}

export interface OrganizationShellProps {
  orgSlug: string;
  me: MeResponse;
  organizations: MyOrganizationSummary[];
  children: ReactNode;
}

/**
 * The persistent shell of one business, built from the person's real businesses. A slug that is not one of
 * theirs is a 404 (the same answer for "does not exist" and "not yours"). A suspended business shows its
 * explanation instead of the page, with the top bar kept so the person can still switch or sign out.
 */
export async function OrganizationShell(props: OrganizationShellProps): Promise<ReactElement> {
  const { orgSlug, me, organizations } = props;
  const { t } = await getTranslator();
  const current = organizations.find((organization) => organization.slug === orgSlug);
  if (!current) notFound();
  const topBar = (
    <TopBar
      logo={<BrandLogo />}
      organizationName={current.name}
      actions={
        <AccountMenuContainer
          userName={me.name}
          currentOrganizationSlug={orgSlug}
          organizations={organizations}
        />
      }
    />
  );
  if (current.status === ORGANIZATION_STATUS.SUSPENDED) {
    return (
      <AppShell hasSidebar={false} topBar={topBar} sidebar={null} bottomNav={null}>
        <EmptyState message={t("errors.org_suspended")} />
      </AppShell>
    );
  }
  const menuGroups: SidebarGroup[] = [];
  return (
    <AppShell
      hasSidebar={menuGroups.length > 0}
      topBar={topBar}
      sidebar={<Sidebar groups={menuGroups} navLabel={t("nav.primary")} />}
      bottomNav={<MobileNavigation orgSlug={orgSlug} t={t} />}
    >
      {props.children}
    </AppShell>
  );
}
