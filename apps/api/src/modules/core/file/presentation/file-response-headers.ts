import type { Response } from "express";
import { pipeline } from "node:stream/promises";
import type { FileContent } from "../application/file-content.js";

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export const FILE_CACHE_CONTROL = {
  /** Only the signed-in member's browser may keep it. */
  PRIVATE: "private, max-age=0, must-revalidate",
  /** Ids never change what they point at, so a public image can be cached for a long time. */
  PUBLIC: `public, max-age=${ONE_YEAR_SECONDS}, immutable`,
} as const;

function contentDisposition(content: FileContent): string {
  if (!content.isDocument) return "inline";
  // RFC 5987: the name is only a suggestion for the download dialog; it was sanitized when stored.
  return `attachment; filename*=UTF-8''${encodeURIComponent(content.originalName)}`;
}

/**
 * Streams stored bytes with the headers that keep them inert in a browser: the type is fixed by
 * what we stored, `nosniff` stops guessing, and PDFs download instead of rendering.
 */
export async function sendFileContent(input: {
  readonly response: Response;
  readonly content: FileContent;
  readonly cacheControl: string;
  readonly isEmbeddable: boolean;
}): Promise<void> {
  const { response, content } = input;
  response.setHeader("Content-Type", content.mimeType);
  response.setHeader("Content-Length", String(content.byteSize));
  response.setHeader("Cache-Control", input.cacheControl);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Content-Disposition", contentDisposition(content));
  response.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  // Public images are embedded by the storefronts, which live on other origins.
  if (input.isEmbeddable) response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  await pipeline(content.stream, response);
}
