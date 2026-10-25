"use client";

import type { Locale } from "@banijjik/i18n";
import { FormField, TextInput } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { PROXY_API_PREFIX } from "../api/client-api";
import { translatorFor } from "../i18n/client-translator";

export interface PhotoUploadInputProps {
  readonly organizationId: string;
  readonly locale: Locale;
}

const UPLOAD_FIELD_NAME = "file";

/**
 * Adds one photo to the listing through the proxy (multipart, field `file`). The upload changes the listing
 * version, so a success reloads the page: the next draft save then carries the new version.
 */
export function PhotoUploadInput({ organizationId, locale }: PhotoUploadInputProps): ReactElement {
  const t = translatorFor(locale).t;
  const [isBusy, setIsBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function upload(file: File): Promise<void> {
    setIsBusy(true);
    setFailed(false);
    const body = new FormData();
    body.append(UPLOAD_FIELD_NAME, file);
    const response = await fetch(`${PROXY_API_PREFIX}/orgs/${organizationId}/my/listing/photos`, {
      method: "POST",
      body,
      credentials: "same-origin",
    });
    setIsBusy(false);
    if (!response.ok) return setFailed(true);
    window.location.reload();
  }

  return (
    <FormField
      label={t("storefront.account.photoLabel")}
      htmlFor="listing-photo"
      hint={t("storefront.account.photoHint")}
    >
      <TextInput
        id="listing-photo"
        name="photo"
        type="file"
        accept="image/*"
        disabled={isBusy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) void upload(file);
        }}
      />
      {failed ? (
        <p role="alert" className="text-small text-danger">
          {t("storefront.account.photoFailed")}
        </p>
      ) : null}
    </FormField>
  );
}
