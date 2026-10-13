"use client";

import { SessionRenewal as SharedSessionRenewal } from "@banijjik/web-client/client";
import type { ReactElement } from "react";
import { refreshSession } from "../api/platform-api-client";
import { buildSessionRenewedCookie } from "./session-renewed-marker";

/** The platform app's renewal step. The shared component does the work; this one names this app's refresh call. */
export function SessionRenewal({ nextPath }: { nextPath: string }): ReactElement {
  return (
    <SharedSessionRenewal
      nextPath={nextPath}
      refreshSession={refreshSession}
      buildRenewedCookie={buildSessionRenewedCookie}
    />
  );
}
