"use client";

import type { MyOrganizationSummary } from "@banijjik/contracts";
import { SUPPORTED_LOCALES, type Locale, type Translator } from "@banijjik/i18n";
import {
  AccountMenuTrigger,
  type AccountMenuLanguage,
  type AccountMenuOrganization,
} from "@banijjik/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { signOut } from "../auth/sign-out";
import { ApiError } from "../lib/api/api-error";
import { fetchMyOrganizations, MY_ORGANIZATIONS_QUERY_KEY } from "../lib/api/me-api";
import { useTranslator } from "../lib/i18n/i18n-provider";
import { initialsOf } from "./initials";
import { LazyAccountMenu } from "./lazy-account-menu";
import { useLocaleChange } from "./use-locale-change";

export interface AccountMenuContainerProps {
  userName: string;
  /** Slug of the business being viewed; absent on the page that lists businesses. */
  currentOrganizationSlug?: string;
  /** Loaded by the server layout; seeds the TanStack Query cache so the menu needs no request. */
  initialOrganizations: MyOrganizationSummary[];
}

function useMyOrganizations(initial: MyOrganizationSummary[]): MyOrganizationSummary[] {
  const query = useQuery({
    queryKey: MY_ORGANIZATIONS_QUERY_KEY,
    queryFn: fetchMyOrganizations,
    initialData: initial,
  });
  return query.data;
}

function toMenuOrganizations(
  organizations: MyOrganizationSummary[],
  currentSlug: string | undefined,
): AccountMenuOrganization[] {
  return organizations.map((organization) => ({
    organizationId: organization.organizationId,
    name: organization.name,
    href: `/${organization.slug}`,
    isCurrent: organization.slug === currentSlug,
  }));
}

function toMenuLanguages(translator: Translator, current: Locale): AccountMenuLanguage[] {
  return SUPPORTED_LOCALES.map((localeKey) => ({
    localeKey,
    label: translator.t(`language.${localeKey}`),
    isCurrent: localeKey === current,
  }));
}

/** Sign out; a failure is shown as a toast and the person stays signed in. */
function useSignOut(translator: Translator): () => void {
  const queryClient = useQueryClient();
  return () => {
    async function run(): Promise<void> {
      try {
        await signOut(queryClient);
      } catch (error) {
        const messageKey = error instanceof ApiError ? error.messageKey : "errors.internal";
        // The toast library loads on demand, like the Toaster itself (13-UX section 11).
        const { toast } = await import("@banijjik/ui/toast");
        toast.error(translator.t(knownMessageKeyOrInternal(messageKey)));
      }
    }
    void run();
  };
}

/** The account button in the top bar and the sheet it opens: businesses, language, sign out. */
export function AccountMenuContainer(props: AccountMenuContainerProps): ReactElement {
  const translator = useTranslator();
  const { t, locale } = translator;
  const [isOpen, setIsOpen] = useState(false);
  const organizations = useMyOrganizations(props.initialOrganizations);
  const changeLocale = useLocaleChange();
  const handleSignOut = useSignOut(translator);
  return (
    <>
      <AccountMenuTrigger
        initials={initialsOf(props.userName)}
        label={t("shell.account")}
        onClick={() => setIsOpen(true)}
      />
      <LazyAccountMenu
        open={isOpen}
        onOpenChange={setIsOpen}
        title={t("shell.account")}
        closeLabel={t("shell.closeMenu")}
        userName={props.userName}
        organizationsHeading={t("orgs.title")}
        organizations={toMenuOrganizations(organizations, props.currentOrganizationSlug)}
        languageHeading={t("account.language")}
        languages={toMenuLanguages(translator, locale)}
        onLocaleChange={changeLocale}
        signOutLabel={t("account.signOut")}
        onSignOut={handleSignOut}
      />
    </>
  );
}
