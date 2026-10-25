"use client";

import type { Locale } from "@banijjik/i18n";
import { Button } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { callStorefront } from "../api/client-api";
import { translatorFor } from "../i18n/client-translator";

export interface ArchiveListingButtonProps {
  readonly organizationId: string;
  readonly locale: Locale;
}

/** Archiving takes the listing out of search; a second click confirms it (no accidental archive). */
export function ArchiveListingButton({
  organizationId,
  locale,
}: ArchiveListingButtonProps): ReactElement {
  const t = translatorFor(locale).t;
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function archive(): Promise<void> {
    setIsBusy(true);
    setFailed(false);
    const result = await callStorefront("DELETE", `/orgs/${organizationId}/my/listing`);
    setIsBusy(false);
    if (!result.ok) return setFailed(true);
    router.push("/my/listing");
  }

  if (!isConfirming) {
    return (
      <Button variant="secondary" onClick={() => setIsConfirming(true)}>
        {t("storefront.account.archive")}
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-md border border-danger p-4">
      <p className="text-body text-primary">{t("storefront.account.archiveConfirm")}</p>
      {failed ? (
        <p role="alert" className="text-small text-danger">
          {t("storefront.error.generic")}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button variant="danger" isLoading={isBusy} onClick={() => void archive()}>
          {t("storefront.account.archiveAction")}
        </Button>
        <Button variant="ghost" disabled={isBusy} onClick={() => setIsConfirming(false)}>
          {t("storefront.account.cancel")}
        </Button>
      </div>
    </div>
  );
}
