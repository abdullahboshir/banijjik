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
  let response: Response;
  try {
    response = await fetch(url, {
      ...input,
      method: "POST",
      redirect: "error",
      signal: controller.signal,
    });
  } catch {
    throw new SmsTransientError();
  } finally {
    clearTimeout(timeout);
  }

  if (response.status >= 500 || response.status === 429) throw new SmsTransientError();
  try {
    return { status: response.status, body: parseBody(await response.text()) };
  } catch {
    if (response.status < 400) throw new SmsTransientError();
    return { status: response.status, body: {} };
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
