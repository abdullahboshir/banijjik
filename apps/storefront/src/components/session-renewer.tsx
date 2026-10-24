"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactElement } from "react";

export interface SessionRenewerProps {
  readonly organizationId: string;
}

/**
 * A visitor whose access cookie is gone (it lasts 15 minutes) may still hold the refresh cookie, which only
 * the storefront API path receives. This asks once, through the proxy, for a new access cookie; when it
 * works the page is rendered again with the customer signed in. A refused refresh changes nothing.
 */
export function SessionRenewer({ organizationId }: SessionRenewerProps): ReactElement | null {
  const router = useRouter();
  const hasAskedRef = useRef(false);

  useEffect(() => {
    if (hasAskedRef.current) return;
    hasAskedRef.current = true;
    void refreshIfRenewed(organizationId, () => router.refresh());
  }, [organizationId, router]);

  return null;
}

async function refreshIfRenewed(organizationId: string, onRenewed: () => void): Promise<void> {
  if (await renewSession(organizationId)) onRenewed();
}

async function renewSession(organizationId: string): Promise<boolean> {
  const response = await fetch(`/api/v1/storefront/orgs/${organizationId}/auth/refresh`, {
    method: "POST",
    credentials: "same-origin",
  }).catch(() => undefined);
  return response?.ok === true;
}
