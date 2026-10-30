"use client";

import type { Locale } from "@banijjik/i18n";
import { Button, formatPhoneForDisplay } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { translatorFor } from "../i18n/client-translator";
import type { CheckoutDetailResponse } from "./requests-api";

export interface GuestClaimCardProps {
  readonly checkoutId: string;
  readonly data: CheckoutDetailResponse;
  readonly isClaiming: boolean;
  readonly onClaim: () => void;
  readonly locale: Locale;
}

export function GuestClaimCard({
  checkoutId,
  data,
  isClaiming,
  onClaim,
  locale,
}: GuestClaimCardProps): ReactElement {
  const t = translatorFor(locale).t;
  const phone = formatPhoneForDisplay(data.contactSnapshot.phoneE164);

  if (data.ownerType === "CUSTOMER") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-4 text-caption text-secondary">
        <span className="text-base select-none" aria-hidden="true">
          ✓
        </span>
        <span>{t("storefront.requests.linkedAccount")}</span>
      </div>
    );
  }

  if (data.canClaim) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-muted/30 p-4 sm:p-6">
        <h2 className="text-body font-semibold text-primary">{t("storefront.claim.title")}</h2>
        <p className="text-caption text-secondary">
          {t("storefront.claim.description", { phone })}
        </p>
        <div>
          <Button onClick={onClaim} isLoading={isClaiming} className="min-h-[44px] min-w-[44px]">
            {isClaiming ? t("storefront.claim.claiming") : t("storefront.claim.button")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-muted/30 p-4 sm:p-6">
      <h2 className="text-body font-semibold text-primary">{t("storefront.claim.title")}</h2>
      <p className="text-caption text-secondary">{t("storefront.claim.guestNotice", { phone })}</p>
      <div>
        <Link
          href={`/sign-in?next=${encodeURIComponent(`/checkouts/${checkoutId}`)}`}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md bg-primary px-4 py-2 text-caption font-semibold text-surface hover:opacity-90"
        >
          {t("storefront.claim.signInAction")}
        </Link>
      </div>
    </div>
  );
}
