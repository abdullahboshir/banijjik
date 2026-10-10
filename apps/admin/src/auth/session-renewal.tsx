"use client";

import { EmptyState } from "@banijjik/ui";
import { useEffect, type ReactElement } from "react";
import { refreshSession } from "../lib/api/refresh-session";
import { useTranslator } from "../lib/i18n/i18n-provider";
import { buildSignInPath, safeNextPath } from "./safe-next-path";

/** A renewal that cannot even reach the API counts as failed: the sign-in page can explain more than this one. */
async function tryRenewal(): Promise<boolean> {
  try {
    return await refreshSession();
  } catch {
    return false;
  }
}

/**
 * The silent renewal step between "the server found no valid session" and the sign-in page. The refresh
 * cookie is only sent to the API, so this has to run in the browser. A renewal that works returns to the
 * page that was asked for; one that fails goes to sign-in with the same destination.
 */
export function SessionRenewal({ nextPath }: { nextPath: string }): ReactElement {
  const { t } = useTranslator();

  useEffect(() => {
    async function renew(): Promise<void> {
      const destination = safeNextPath(nextPath);
      const isRenewed = await tryRenewal();
      window.location.replace(isRenewed ? destination : buildSignInPath(destination));
    }
    void renew();
  }, [nextPath]);

  return (
    <main role="status" className="p-4">
      <EmptyState message={t("auth.session.renewing")} />
    </main>
  );
}
