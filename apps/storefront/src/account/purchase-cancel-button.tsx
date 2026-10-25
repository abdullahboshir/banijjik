"use client";

import { Button } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { callStorefront } from "../api/client-api";
import { translatorFor } from "../i18n/client-translator";
import type { Locale } from "@banijjik/i18n";

export interface PurchaseCancelButtonProps {
  readonly organizationId: string;
  readonly creditPurchaseId: string;
  readonly locale: Locale;
}

/** Cancels a purchase that staff have not verified yet; the server refuses any other state. */
export function PurchaseCancelButton({
  organizationId,
  creditPurchaseId,
  locale,
}: PurchaseCancelButtonProps): ReactElement {
  const t = translatorFor(locale).t;
  const [isBusy, setIsBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function cancel(): Promise<void> {
    setIsBusy(true);
    setFailed(false);
    const result = await callStorefront(
      "POST",
      `/orgs/${organizationId}/credit-purchases/${creditPurchaseId}/cancel`,
    );
    setIsBusy(false);
    if (!result.ok) return setFailed(true);
    window.location.reload();
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" isLoading={isBusy} onClick={() => void cancel()}>
        {t("storefront.credits.cancelPurchase")}
      </Button>
      {failed ? (
        <p role="alert" className="text-small text-danger">
          {t("storefront.error.generic")}
        </p>
      ) : null}
    </div>
  );
}
