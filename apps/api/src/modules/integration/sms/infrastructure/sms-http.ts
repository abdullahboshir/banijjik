import { SmsTransientError } from "../application/ports.js";

export const SMS_HTTP_TIMEOUT_MS = 10_000;

/** The timeout covers the body too. Never propagate fetch errors that might contain credentials. */
export async function smsPost(
  url: string,
  input: RequestInit,
  timeoutMs = SMS_HTTP_TIMEOUT_MS,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await sendRequest(url, input, controller.signal);
    if (response.status >= 500 || response.status === 429) throw new SmsTransientError();
    return { status: response.status, body: await readBody(response) };
  } finally {
    clearTimeout(timeout);
  }
}

async function sendRequest(url: string, input: RequestInit, signal: AbortSignal) {
  try {
    return await fetch(url, { ...input, method: "POST", redirect: "error", signal });
  } catch {
    throw new SmsTransientError();
  }
}

/**
 * A body that cannot be read (timeout, broken stream) is transient below 400. From 400 on the
 * status already says the provider refused, so an unreadable body stays a permanent refusal.
 */
async function readBody(response: Response): Promise<Record<string, unknown>> {
  try {
    return parseBody(await response.text());
  } catch {
    if (response.status < 400) throw new SmsTransientError();
    return {};
  }
}

function parseBody(text: string): Record<string, unknown> {
  try {
    const payload: unknown = JSON.parse(text);
    return isRecord(payload) ? payload : {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function containsUnicode(text: string): boolean {
  return [...text].some((character) => character.charCodeAt(0) > 127);
}

export function numericCode(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (value === "") return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}
