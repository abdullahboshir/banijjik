"use client";

import type { Locale } from "@banijjik/i18n";
import { useEffect, useState, type ReactElement } from "react";
import { translatorFor } from "../i18n/client-translator";

export interface HoldCountdownProps {
  readonly expiresAt: string;
  readonly locale: Locale;
}

/**
 * Displays live countdown until holdExpiresAt timestamp.
 */
export function HoldCountdown({ expiresAt, locale }: HoldCountdownProps): ReactElement {
  const t = translatorFor(locale).t;
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const targetTime = new Date(expiresAt).getTime();
  const remainingSeconds = Math.max(0, Math.floor((targetTime - now) / 1000));

  if (remainingSeconds <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-danger">
        <span className="size-2 rounded-full bg-danger" />
        {t("storefront.requests.holdExpired")}
      </span>
    );
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <span
      className="inline-flex items-center gap-1.5 text-caption font-semibold text-warning"
      aria-live="polite"
    >
      <span className="size-2 rounded-full bg-warning animate-pulse" />
      {t("storefront.requests.holdExpiresIn", { time: formattedTime })}
    </span>
  );
}
