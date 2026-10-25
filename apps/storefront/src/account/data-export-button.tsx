"use client";

import { Button } from "@banijjik/ui";
import type { Locale } from "@banijjik/i18n";
import { useState, type ReactElement } from "react";
import { PROXY_API_PREFIX } from "../api/client-api";
import { translatorFor } from "../i18n/client-translator";

export interface DataExportButtonProps {
  readonly organizationId: string;
  readonly locale: Locale;
}

const EXPORT_FILE_NAME = "my-data.json";

/** Downloads the export the API returns as a JSON file (M.6 C5): the page does not keep it. */
export function DataExportButton({ organizationId, locale }: DataExportButtonProps): ReactElement {
  const t = translatorFor(locale).t;
  const [failed, setFailed] = useState(false);

  async function download(): Promise<void> {
    setFailed(false);
    const response = await fetch(`${PROXY_API_PREFIX}/orgs/${organizationId}/my/data-export`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return setFailed(true);
    const envelope = (await response.json()) as { data: unknown };
    const blob = new Blob([JSON.stringify(envelope.data, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = EXPORT_FILE_NAME;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" onClick={() => void download()}>
        {t("storefront.account.exportButton")}
      </Button>
      {failed ? (
        <p role="alert" className="text-small text-danger">
          {t("storefront.error.generic")}
        </p>
      ) : null}
    </div>
  );
}
