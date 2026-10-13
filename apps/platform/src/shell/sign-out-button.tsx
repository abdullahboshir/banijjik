"use client";

import { useTranslator } from "@banijjik/web-client/client";
import { Button } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { signOut } from "../auth/sign-out";

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
    <Button
      variant="ghost"
      className="px-2 sm:px-4"
      isLoading={isSigningOut}
      onClick={() => void handleClick()}
    >
      {t("account.signOut")}
    </Button>
  );
}
