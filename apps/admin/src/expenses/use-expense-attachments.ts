"use client";

import { FILE_PURPOSE } from "@banijjik/contracts/file";
import { MAX_EXPENSE_ATTACHMENTS } from "@banijjik/contracts/accounting";
import type { ImageInputLabels } from "@banijjik/ui";
import { organizationFileUrl, uploadFile } from "@banijjik/web-client";
import { useState } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { API_BASE_URL } from "../config/api-base-url";
import { apiFetch } from "../lib/api/api-client";
import { API_PREFIX } from "../lib/api/api-url";
import { ApiError } from "../lib/api/api-error";

const URL_BASE = { baseUrl: API_BASE_URL, apiPrefix: API_PREFIX };
const PREVIEW_VARIANT = "thumb" as const;

export interface ExpenseAttachments {
  readonly isUploading: boolean;
  readonly uploadError: string | undefined;
  readonly previewUrlOf: (fileId: string) => string;
  readonly upload: (file: File) => void;
  readonly remove: (fileId: string) => void;
  readonly canAddMore: boolean;
  readonly imageLabels: ImageInputLabels;
}

/**
 * Uploads a photo for purpose ATTACHMENT the moment it is picked (3.0). The ids go on the create
 * body only when the sheet is saved; the API checks purpose and ownership again.
 */
export function useExpenseAttachments(input: {
  organizationId: string;
  attachmentFileIds: readonly string[];
  onChange: (fileIds: string[]) => void;
  imageLabels: ImageInputLabels;
}): ExpenseAttachments {
  const { organizationId, attachmentFileIds, onChange, imageLabels } = input;
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | undefined>();

  async function run(file: File): Promise<void> {
    if (attachmentFileIds.length >= MAX_EXPENSE_ATTACHMENTS) return;
    setIsUploading(true);
    setUploadError(undefined);
    try {
      const uploaded = await uploadFile(apiFetch, {
        organizationId,
        purpose: FILE_PURPOSE.ATTACHMENT,
        file,
      });
      onChange([...attachmentFileIds, uploaded.fileId]);
    } catch (error) {
      setUploadError(
        error instanceof ApiError ? knownMessageKeyOrInternal(error.messageKey) : "errors.internal",
      );
    }
    setIsUploading(false);
  }

  return {
    isUploading,
    uploadError,
    previewUrlOf: (fileId) =>
      organizationFileUrl(URL_BASE, {
        organizationId,
        fileId,
        variant: PREVIEW_VARIANT,
      }),
    upload: (file) => void run(file),
    remove: (fileId) => onChange(attachmentFileIds.filter((id) => id !== fileId)),
    canAddMore: attachmentFileIds.length < MAX_EXPENSE_ATTACHMENTS,
    imageLabels,
  };
}
