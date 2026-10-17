"use client";

import { CUSTOM_FIELD_TYPE, type EffectiveCustomField } from "@banijjik/contracts";
import { FILE_PURPOSE, type FilePurpose } from "@banijjik/contracts/file";
import type { CustomFieldFileSupport, FileInputLabels, ImageInputLabels } from "@banijjik/ui";
import { organizationFileUrl, uploadFile } from "@banijjik/web-client";
import { useMemo, useState } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { API_BASE_URL } from "../config/api-base-url";
import { apiFetch } from "../lib/api/api-client";
import { API_PREFIX } from "../lib/api/api-url";
import { ApiError } from "../lib/api/api-error";

const URL_BASE = { baseUrl: API_BASE_URL, apiPrefix: API_PREFIX };
const PREVIEW_VARIANT = "thumb";

export interface CustomFieldFiles {
  readonly support: CustomFieldFileSupport;
  /** Message key per field key for uploads the API refused. */
  readonly uploadErrors: Readonly<Record<string, string | undefined>>;
}

export interface CustomFieldFilesInput {
  readonly organizationId: string;
  readonly fields: readonly EffectiveCustomField[];
  readonly onChange: (fieldKey: string, value: unknown) => void;
  readonly imageLabels: ImageInputLabels;
  readonly fileLabels: FileInputLabels;
}

function purposeOf(field: EffectiveCustomField | undefined): FilePurpose | undefined {
  if (field?.fieldType === CUSTOM_FIELD_TYPE.IMAGE) return FILE_PURPOSE.CUSTOM_FIELD_IMAGE;
  if (field?.fieldType === CUSTOM_FIELD_TYPE.FILE) return FILE_PURPOSE.CUSTOM_FIELD_FILE;
  return undefined;
}

function messageKeyOf(error: unknown): string {
  return error instanceof ApiError
    ? knownMessageKeyOrInternal(error.messageKey)
    : "errors.internal";
}

/**
 * Uploads the picked file the moment it is chosen and stores its id as the field value (2.3's rule:
 * a FILE or IMAGE value is the `fileId`). The value reaches the API only when the sheet is saved,
 * where the server checks that the file is this organization's, active, and of the right purpose.
 */
export function useCustomFieldFiles(input: CustomFieldFilesInput): CustomFieldFiles {
  const { organizationId, fields, onChange, imageLabels, fileLabels } = input;
  const [uploading, setUploading] = useState<ReadonlySet<string>>(new Set());
  const [uploadErrors, setUploadErrors] = useState<Record<string, string | undefined>>({});

  return useMemo(() => {
    function setBusy(fieldKey: string, isBusy: boolean): void {
      setUploading((current) => {
        const next = new Set(current);
        if (isBusy) next.add(fieldKey);
        else next.delete(fieldKey);
        return next;
      });
    }

    async function onPick(fieldKey: string, file: File): Promise<void> {
      const purpose = purposeOf(fields.find((field) => field.fieldKey === fieldKey));
      if (purpose === undefined) return;
      setBusy(fieldKey, true);
      setUploadErrors((current) => ({ ...current, [fieldKey]: undefined }));
      try {
        const uploaded = await uploadFile(apiFetch, { organizationId, purpose, file });
        onChange(fieldKey, uploaded.fileId);
      } catch (error) {
        setUploadErrors((current) => ({ ...current, [fieldKey]: messageKeyOf(error) }));
      }
      setBusy(fieldKey, false);
    }

    const addressOf = (value: unknown, variant?: typeof PREVIEW_VARIANT): string | undefined =>
      typeof value === "string" && value !== ""
        ? organizationFileUrl(URL_BASE, {
            organizationId,
            fileId: value,
            ...(variant === undefined ? {} : { variant }),
          })
        : undefined;

    const support: CustomFieldFileSupport = {
      onPick: (fieldKey, file) => void onPick(fieldKey, file),
      onClear: (fieldKey) => onChange(fieldKey, null),
      isUploading: (fieldKey) => uploading.has(fieldKey),
      previewUrlOf: (value) => addressOf(value, PREVIEW_VARIANT),
      hrefOf: (value) => addressOf(value),
      imageLabels,
      fileLabels,
      sendsCredentials: true,
    };
    return { support, uploadErrors };
  }, [organizationId, fields, onChange, imageLabels, fileLabels, uploading, uploadErrors]);
}
