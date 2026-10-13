import { LanguageSwitch } from "@banijjik/web-client/client";
import { AppShell, TopBar } from "@banijjik/ui";
import type { ReactElement, ReactNode } from "react";
import { loadOperator } from "../../src/auth/session-data";
import { getTranslator } from "../../src/i18n/get-translator";
import { setLocaleAction } from "../../src/i18n/set-locale.action";
import { BrandLogo } from "../../src/shell/brand-logo";
import { navigationEntriesFor } from "../../src/shell/navigation-entries";
import { PanelBottomNav, PanelSidebar } from "../../src/shell/panel-navigation";
import { SignOutButton } from "../../src/shell/sign-out-button";

/**
 * The shell of every signed-in page. The operator comes from `GET /platform/me`: no session sends the visitor
 * to the renewal page, and the permissions decide which entries the menu shows. The API enforces them again.
 */
export default async function PanelLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactElement> {
  const [operator, { t }] = await Promise.all([loadOperator(), getTranslator()]);
  const entries = navigationEntriesFor(operator, t);
  const navigation = { entries, navLabel: t("platform.nav.label") };
  return (
    <AppShell
      topBar={
        <TopBar
          logo={<BrandLogo />}
          organizationName={operator.name}
          actions={
            <>
              <LanguageSwitch buttonClassName="px-2 sm:px-4" setLocale={setLocaleAction} />
              <SignOutButton />
            </>
          }
        />
      }
      sidebar={<PanelSidebar {...navigation} />}
      bottomNav={<PanelBottomNav {...navigation} />}
      hasSidebar={entries.length > 0}
    >
      {children}
    </AppShell>
  );
}
