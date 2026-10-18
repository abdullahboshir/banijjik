"use client";

import { FILE_PURPOSE } from "@banijjik/contracts/file";
import { publicFileUrl, uploadFile } from "@banijjik/web-client";
import { useState } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { API_BASE_URL } from "../config/api-base-url";
import { apiFetch } from "../lib/api/api-client";
import { ApiError } from "../lib/api/api-error";

const PREVIEW_VARIANT = "medium";

export interface LogoUpload {
  isUploading: boolean;
  /** Message key of the upload the API refused; absent while all is well. */
  errorKey: string | undefined;
  /** Uploads the picked file for the LOGO purpose and tells the form the new file and where it shows. */
  upload: (file: File) => void;
}

/**
 * The upload runs the moment a file is picked, like the custom field images; the file becomes the
 * logo only when the form is saved, where the API checks it again (ADR-114).
 */
export function useLogoUpload(
  organizationId: string,
  onUploaded: (fileId: string, previewUrl: string) => void,
): LogoUpload {
  const [isUploading, setIsUploading] = useState(false);
  const [errorKey, setErrorKey] = useState<string | undefined>();

  async function run(file: File): Promise<void> {
    setIsUploading(true);
    setErrorKey(undefined);
    try {
      const uploaded = await uploadFile(apiFetch, {
        organizationId,
        purpose: FILE_PURPOSE.LOGO,
        file,
      });
      onUploaded(uploaded.fileId, publicFileUrl(API_BASE_URL, uploaded.fileId, PREVIEW_VARIANT));
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      setErrorKey(knownMessageKeyOrInternal(error.messageKey));
    }
    setIsUploading(false);
  }

  return { isUploading, errorKey, upload: (file) => void run(file) };
}
