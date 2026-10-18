"use client";

import { useState } from "react";

export interface LogoUpload {
  isUploading: boolean;
  /** Message key of the upload the API refused; absent while all is well. */
  errorKey: string | undefined;
  /** Uploads the picked file for the LOGO purpose and tells the form the new file and where it shows. */
  upload: (file: File) => void;
}

/**
 * The upload runs the moment a file is picked, like the custom field images; the file becomes the
 * logo only when the form is saved, where the API checks it again (ADR-114). The upload code loads on
 * the first pick, so the page's first scripts stay small (13-UX section 11).
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
    const { uploadLogo } = await import("./branding-actions");
    const outcome = await uploadLogo(organizationId, file);
    if (outcome.ok) onUploaded(outcome.fileId, outcome.previewUrl);
    else setErrorKey(outcome.errorKey);
    setIsUploading(false);
  }

  return { isUploading, errorKey, upload: (file) => void run(file) };
}
