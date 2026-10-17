import {
  publicFilePath,
  type FileAssetResponse,
  type FilePurpose,
  type FileVariant,
} from "@banijjik/contracts/file";
import type { ApiFetch } from "./api-client.js";

export interface UploadFileInput {
  readonly organizationId: string;
  readonly purpose: FilePurpose;
  readonly file: File;
}

/**
 * Uploads one file for the organization (card 3.0). The purpose goes first so the API knows what
 * it is reading before the bytes arrive; the API checks the real content, not the name or type.
 */
export async function uploadFile(
  apiFetch: ApiFetch,
  input: UploadFileInput,
): Promise<FileAssetResponse> {
  const body = new FormData();
  body.append("purpose", input.purpose);
  body.append("file", input.file, input.file.name);
  const result = await apiFetch<FileAssetResponse>(`/orgs/${input.organizationId}/files`, {
    method: "POST",
    body,
  });
  return result.data;
}

export interface FileUrlBase {
  /** Origin of the API, without a trailing slash. */
  readonly baseUrl: string;
  /** Path prefix of the API version, such as `/api/v1`. */
  readonly apiPrefix: string;
}

/** The address of a PUBLIC file (a logo, an offering image): no session needed. */
export function publicFileUrl(baseUrl: string, fileId: string, variant: FileVariant): string {
  return `${baseUrl}${publicFilePath(fileId, variant)}`;
}

/** The address of a file of the signed-in organization, PUBLIC or PRIVATE. The browser sends the session cookie. */
export function organizationFileUrl(
  base: FileUrlBase,
  input: {
    readonly organizationId: string;
    readonly fileId: string;
    readonly variant?: FileVariant;
  },
): string {
  const query = input.variant === undefined ? "" : `?variant=${input.variant}`;
  return `${base.baseUrl}${base.apiPrefix}/orgs/${input.organizationId}/files/${input.fileId}/content${query}`;
}
