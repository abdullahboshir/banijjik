"use client";

import { EmptyState } from "@banijjik/ui";
import { useEffect, type ReactElement } from "react";
import { useTranslator } from "./i18n-provider.js";
import { buildSignInPath, safeNextPath } from "./safe-next-path.js";

export interface SessionRenewalProps {
  nextPath: string;
  /** The app's own refresh call (it knows its API prefix). */
  refreshSession: () => Promise<boolean>;
  /** The app's own loop-guard marker cookie (cookies are shared by every port of a host). */
  buildRenewedCookie: () => string;
}

/** A renewal that cannot even reach the API counts as failed: the sign-in page can explain more than this one. */
async function tryRenewal(refreshSession: () => Promise<boolean>): Promise<boolean> {
  try {
    return await refreshSession();
  } catch {
    return false;
  }
}

/**
 * The silent renewal step between "the server found no valid session" and the sign-in page. The refresh
 * cookie is only sent to the API, so this has to run in the browser. A renewal that works leaves a
 * short-lived marker (the loop guard) and returns to the page that was asked for; one that fails goes to
 * sign-in with the same destination.
 */
export function SessionRenewal({
  nextPath,
  refreshSession,
  buildRenewedCookie,
}: SessionRenewalProps): ReactElement {
  const { t } = useTranslator();

  useEffect(() => {
    async function renew(): Promise<void> {
      const destination = safeNextPath(nextPath);
      const isRenewed = await tryRenewal(refreshSession);
      if (!isRenewed) {
        window.location.replace(buildSignInPath(destination));
        return;
      }
      document.cookie = buildRenewedCookie();
      window.location.replace(destination);
    }
    void renew();
  }, [nextPath, refreshSession, buildRenewedCookie]);

  return (
    <main role="status" className="p-4">
      <EmptyState message={t("auth.session.renewing")} />
    </main>
  );
}
