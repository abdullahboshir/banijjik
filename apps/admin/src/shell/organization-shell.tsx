import {
  MODULE_KEY,
  ORGANIZATION_STATUS,
  PERMISSION_KEY,
  type MeResponse,
  type MyOrganizationSummary,
  type ResolvedOrgConfigResponse,
} from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { AppShell, EmptyState, TopBar, type SidebarGroup } from "@banijjik/ui";
import { notFound } from "next/navigation";
import type { ReactElement, ReactNode } from "react";
import { getTranslator } from "../lib/i18n/get-translator";
import { AccountMenuContainer } from "./account-menu-container";
import { bannerStatesOf } from "./banner-state";
import { BrandLogo } from "./brand-logo";
import { BusinessLogo } from "./business-logo";
import { directoryQueueBadgeCount, withQueueBadge } from "./directory-queue-badge";
import { buildMenuGroups, settingsHomeHref } from "./menu-groups";
import { holdsPermission } from "./permissions";
import { ShellNavigation } from "./shell-navigation";
import { ShellSidebar } from "./shell-sidebar";
import { SubscriptionBanners } from "./subscription-banners";

// Create actions arrive with the modules that own them; none exists yet.
function MobileNavigation({
  orgSlug,
  menu,
  t,
}: {
  orgSlug: string;
  menu: SidebarGroup[];
  t: Translator["t"];
}): ReactElement {
  return (
    <ShellNavigation
      menu={menu}
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

function topBarOf(input: {
  current: MyOrganizationSummary;
  me: MeResponse;
  organizations: MyOrganizationSummary[];
  orgSlug: string;
  commissionHref: string | undefined;
  t: Translator["t"];
}): ReactElement {
  const { current, me, organizations, orgSlug, commissionHref, t } = input;
  return (
    <TopBar
      logo={
        current.logoUrl ? (
          <BusinessLogo
            logoUrl={current.logoUrl}
            alt={t("shell.businessLogo", { name: current.name })}
          />
        ) : (
          <BrandLogo />
        )
      }
      organizationName={current.name}
      actions={
        <AccountMenuContainer
          userName={me.name}
          currentOrganizationSlug={orgSlug}
          organizations={organizations}
          commissionHref={commissionHref}
        />
      }
    />
  );
}

/** "My commission" is not a menu entry: staff without the full read permission must still reach their own. */
function commissionHrefOf(
  config: ResolvedOrgConfigResponse | undefined,
  orgSlug: string,
): string | undefined {
  if (config === undefined || !config.modules.includes(MODULE_KEY.COMMISSION)) return undefined;
  if (!holdsPermission(config.permissions, PERMISSION_KEY.COMMISSION_ENTRY_READ_OWN))
    return undefined;
  return `/${orgSlug}/commission/mine`;
}

export interface OrganizationShellProps {
  orgSlug: string;
  me: MeResponse;
  organizations: MyOrganizationSummary[];
  /** Absent for a suspended business, which has no menu (and in tests that need none). */
  config?: ResolvedOrgConfigResponse | undefined;
  /** The business's time zone, for the trial banner; UTC when unknown. */
  timeZone?: string | undefined;
  children: ReactNode;
}

const UTC = "UTC";

/**
 * The persistent shell of one business, built from the person's real businesses and the menu of `/me/config`.
 * A slug that is not one of theirs is a 404 (the same answer for "does not exist" and "not yours"). A suspended
 * business shows its explanation instead of the page, with the top bar kept so the person can still switch or
 * sign out. The menu is drawn on the server; only the "current page" mark needs the browser.
 */
export async function OrganizationShell(props: OrganizationShellProps): Promise<ReactElement> {
  const { orgSlug, me, organizations, config } = props;
  const { t, locale } = await getTranslator();
  const current = organizations.find((organization) => organization.slug === orgSlug);
  if (!current) notFound();
  const topBar = topBarOf({
    current,
    me,
    organizations,
    orgSlug,
    commissionHref: commissionHrefOf(config, orgSlug),
    t,
  });
  if (current.status === ORGANIZATION_STATUS.SUSPENDED) {
    return (
      <AppShell hasSidebar={false} topBar={topBar} sidebar={null} bottomNav={null}>
        <EmptyState message={t("errors.org_suspended")} />
      </AppShell>
    );
  }
  const menuGroups = withQueueBadge(
    buildMenuGroups({
      menu: config?.menu ?? [],
      orgSlug,
      terms: config?.terms ?? {},
      locale,
      t,
    }),
    await directoryQueueBadgeCount(current.organizationId, config?.menu),
  );
  const banners = config ? bannerStatesOf(config, new Date(), props.timeZone ?? UTC) : [];
  return (
    <AppShell
      hasSidebar={menuGroups.length > 0}
      topBar={topBar}
      sidebar={
        <ShellSidebar
          groups={menuGroups}
          navLabel={t("nav.primary")}
          exactMatchHrefs={[`/${orgSlug}`, settingsHomeHref(orgSlug)]}
        />
      }
      bottomNav={<MobileNavigation orgSlug={orgSlug} menu={menuGroups} t={t} />}
    >
      <SubscriptionBanners states={banners} t={t} />
      {props.children}
    </AppShell>
  );
}
