import { AppShell, Sidebar, TopBar } from "@banijjik/ui";
import type { ReactElement, ReactNode } from "react";
import { env } from "../../../src/config/env";
import { getTranslator } from "../../../src/lib/i18n/get-translator";
import { ShellNavigation } from "../../../src/shell/shell-navigation";

export default async function OrganizationShellLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const { orgSlug } = await params;
  const { t } = await getTranslator();
  // Until /me/config is wired (card 1.7) the menu is empty and the org name is its slug.
  return (
    <AppShell
      topBar={
        <TopBar
          logo={
            <span className="text-title font-semibold text-brand">
              {env.NEXT_PUBLIC_BRAND_NAME}
            </span>
          }
          organizationName={orgSlug}
        />
      }
      sidebar={<Sidebar groups={[]} navLabel={t("shell.openMenu")} />}
      bottomNav={
        <ShellNavigation
          menu={[]}
          orgSlug={orgSlug}
          quickCreateActions={[]}
          labels={{
            navLabel: t("shell.openMenu"),
            home: t("nav.home"),
            quickCreate: t("nav.quickCreate"),
            more: t("nav.more"),
            closeLabel: t("shell.closeMenu"),
            emptyText: t("state.empty.default"),
          }}
        />
      }
    >
      {children}
    </AppShell>
  );
}
