import { SmsTransientError } from "../application/ports.js";

const REQUEST_TIMEOUT_MS = 10_000;

/** The timeout covers the body too. Never propagate fetch errors that might contain credentials. */
export async function smsPost(
  url: string,
  input: RequestInit,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...input,
      method: "POST",
      redirect: "error",
      signal: controller.signal,
    });
    if (response.status >= 500 || response.status === 429) throw new SmsTransientError();
    const payload: unknown = await response.json();
    const body = isRecord(payload) ? payload : {};
    return { status: response.status, body };
  } catch {
    throw new SmsTransientError();
  } finally {
    clearTimeout(timeout);
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
