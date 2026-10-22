import { gzipSync } from "node:zlib";
import type { Page } from "puppeteer-core";
import { ADMIN_ORIGIN } from "./browser-stack";

/** 13-UX section 11: initial JavaScript per route, gzip, in KiB. */
export const INITIAL_JS_BUDGET_KIB = 180;
const BYTES_PER_KIB = 1024;
const SCRIPT_TAG = /<script\b[^>]*>/g;
const SOURCE_ATTRIBUTE = /\ssrc="([^"]+)"/;
const NO_MODULE_ATTRIBUTE = /\snomodule\b/i;

export interface InitialJsSize {
  gzipBytes: number;
  fileCount: number;
  /** Each script with its gzip size, for a breakdown when a budget is missed. */
  files: { source: string; gzipBytes: number }[];
}

function scriptSources(html: string): string[] {
  const sources: string[] = [];
  for (const tag of html.match(SCRIPT_TAG) ?? []) {
    const source = SOURCE_ATTRIBUTE.exec(tag)?.[1];
    // Legacy polyfills carry `noModule`: modern browsers never download them.
    if (source !== undefined && !NO_MODULE_ATTRIBUTE.test(tag)) sources.push(source);
  }
  return [...new Set(sources)];
}

async function gzipSizeOf(source: string): Promise<number> {
  const response = await fetch(new URL(source, ADMIN_ORIGIN));
  return gzipSync(Buffer.from(await response.arrayBuffer())).length;
}

/**
 * Opens a route and sums the gzip size of the scripts its HTML references (what the browser must load
 * before the page works). Scripts loaded later on demand are not counted: that is what lazy loading is for.
 */
export async function measureInitialJs(page: Page, path: string): Promise<InitialJsSize> {
  const response = await page.goto(`${ADMIN_ORIGIN}${path}`, { waitUntil: "networkidle0" });
  const sources = scriptSources((await response?.text()) ?? "");
  const sizes = await Promise.all(sources.map(gzipSizeOf));
  return {
    gzipBytes: sizes.reduce((sum, size) => sum + size, 0),
    fileCount: sources.length,
    files: sources.map((source, index) => ({ source, gzipBytes: sizes[index] ?? 0 })),
  };
}

export function toKiB(bytes: number): number {
  return Math.round((bytes / BYTES_PER_KIB) * 10) / 10;
}
