"use client";

import type { Locale } from "@banijjik/i18n";
import { newId } from "@banijjik/ids";
import { Button } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { callStorefront } from "../api/client-api";
import { translatorFor } from "../i18n/client-translator";

export interface ListingActionProps {
  readonly organizationId: string;
  readonly listingNumber: string;
  readonly locale: Locale;
  readonly canUnlock: boolean;
}

interface Attempt {
  readonly method: "POST";
  readonly path: string;
  readonly body?: unknown;
  readonly doneKey: string;
  readonly idempotencyKey?: string;
}

/**
 * The signed-in actions on a listing page: unlock (spends credits; each press sends its own
 * Idempotency-Key) and block (hides the listing from the customer's own search).
 */
export function ListingActions(props: ListingActionProps): ReactElement {
  const t = translatorFor(props.locale).t;
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [isBusy, setIsBusy] = useState(false);

  async function run(attempt: Attempt): Promise<void> {
    setIsBusy(true);
    const result = await callStorefront(attempt.method, attempt.path, {
      body: attempt.body,
      idempotencyKey: attempt.idempotencyKey,
    });
    setIsBusy(false);
    setMessage(result.ok ? attempt.doneKey : "storefront.error.generic");
  }

  const listingPath = `/orgs/${props.organizationId}/listings/${encodeURIComponent(props.listingNumber)}`;
  const unlock: Attempt = {
    method: "POST",
    path: `${listingPath}/unlock`,
    doneKey: "storefront.listing.unlocked",
    idempotencyKey: newId(),
  };
  const block: Attempt = {
    method: "POST",
    path: `/orgs/${props.organizationId}/my/listing-blocks`,
    body: { listingNumber: props.listingNumber },
    doneKey: "storefront.listing.blocked",
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {props.canUnlock ? (
          <Button variant="primary" isLoading={isBusy} onClick={() => void run(unlock)}>
            {t("storefront.listing.unlock")}
          </Button>
        ) : null}
        <Button variant="secondary" isLoading={isBusy} onClick={() => void run(block)}>
          {t("storefront.listing.block")}
        </Button>
      </div>
      {message ? (
        <p role="status" className="text-body text-secondary">
          {t(message)}
        </p>
      ) : null}
    </div>
  );
}
