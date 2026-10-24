"use client";

import { Button } from "@banijjik/ui";
import type { Locale } from "@banijjik/i18n";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { translatorFor } from "../i18n/client-translator";

export interface SignOutButtonProps {
  readonly organizationId: string;
  readonly locale: Locale;
}

const HOME_PATH = "/";

/**
 * Ends the customer's session through the proxy, so the browser sends the refresh cookie that only the
 * storefront API path receives (ADR-119). Then the home page loads without the session.
 */
export function SignOutButton({ organizationId, locale }: SignOutButtonProps): ReactElement {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const { t } = translatorFor(locale);

  async function signOut(): Promise<void> {
    setIsBusy(true);
    await fetch(`/api/v1/storefront/orgs/${organizationId}/auth/logout`, {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => undefined);
    router.push(HOME_PATH);
    router.refresh();
  }

  return (
    <Button variant="secondary" isLoading={isBusy} onClick={() => void signOut()}>
      {t("storefront.signOut.button")}
    </Button>
  );
}
