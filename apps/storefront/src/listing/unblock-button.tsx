"use client";

import type { Locale } from "@banijjik/i18n";
import { Button } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { callStorefront } from "../api/client-api";
import { translatorFor } from "../i18n/client-translator";

export interface UnblockButtonProps {
  readonly organizationId: string;
  readonly listingNumber: string;
  readonly locale: Locale;
}

/** Brings a blocked listing back into the customer's search. */
export function UnblockButton({
  organizationId,
  listingNumber,
  locale,
}: UnblockButtonProps): ReactElement {
  const t = translatorFor(locale).t;
  const [isBusy, setIsBusy] = useState(false);

  async function unblock(): Promise<void> {
    setIsBusy(true);
    const result = await callStorefront(
      "DELETE",
      `/orgs/${organizationId}/my/listing-blocks/${encodeURIComponent(listingNumber)}`,
    );
    setIsBusy(false);
    if (result.ok) window.location.reload();
  }

  return (
    <Button variant="secondary" isLoading={isBusy} onClick={() => void unblock()}>
      {t("storefront.connections.unblock")}
    </Button>
  );
}
