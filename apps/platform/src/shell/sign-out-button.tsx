"use client";

import { Button } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { signOut } from "../auth/sign-out";
import { useTranslator } from "../i18n/i18n-provider";

/** Sign out; a failure is shown as a toast and the operator stays signed in. */
export function SignOutButton(): ReactElement {
  const { t } = useTranslator();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleClick(): Promise<void> {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch {
      // The toast library loads on demand, like the Toaster itself (13-UX section 11).
      const { toast } = await import("@banijjik/ui/toast");
      toast.error(t("errors.network"));
      setIsSigningOut(false);
    }
  }

  return (
    <Button variant="ghost" isLoading={isSigningOut} onClick={() => void handleClick()}>
      {t("account.signOut")}
    </Button>
  );
}
