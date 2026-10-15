import { ERROR_CODE } from "@banijjik/contracts";
import type { TranslationValues } from "@banijjik/i18n";
import { ApiError } from "@banijjik/web-client";

/** A dependency a package is missing: `moduleKey` needs `missingDependency` (the closure rule, 10 section 3). */
export interface ClosureGap {
  moduleKey: string;
  missingDependency: string;
}

/** What a form shows when the API refuses: a message key (known to the catalog) and, for a package, its gaps. */
export interface FormFailure {
  messageKey: string;
  values?: TranslationValues;
  gaps: ClosureGap[];
  /** `details.removed` of an industry-template change that is not additive. */
  removed: string[];
}

const INTERNAL_KEY = "errors.internal";
const SECONDS_PER_MINUTE = 60;

function readGaps(details: ApiError["details"]): ClosureGap[] {
  const gaps: unknown = details?.["gaps"];
  if (!Array.isArray(gaps)) return [];
  return gaps.flatMap((gap: unknown): ClosureGap[] => {
    if (typeof gap !== "object" || gap === null) return [];
    // Safe: both fields are checked as strings before use; any other shape is dropped.
    const { moduleKey, missingDependency } = gap as Partial<ClosureGap>;
    return typeof moduleKey === "string" && typeof missingDependency === "string"
      ? [{ moduleKey, missingDependency }]
      : [];
  });
}

function readRemoved(details: ApiError["details"]): string[] {
  const removed: unknown = details?.["removed"];
  if (!Array.isArray(removed)) return [];
  return removed.filter((item): item is string => typeof item === "string");
}

/**
 * Turns any failure into something a form can show. An unknown message key from the server would show as raw
 * text, so it becomes the generic error; a rate limit shows its wait.
 */
export function failureOf(
  error: unknown,
  hasMessage: (messageKey: string) => boolean,
): FormFailure {
  if (!(error instanceof ApiError)) return { messageKey: INTERNAL_KEY, gaps: [], removed: [] };
  if (error.code === ERROR_CODE.RATE_LIMITED && error.retryAfterSeconds !== undefined) {
    const minutes = Math.ceil(error.retryAfterSeconds / SECONDS_PER_MINUTE);
    return { messageKey: "auth.rateLimited", values: { minutes }, gaps: [], removed: [] };
  }
  const messageKey = hasMessage(error.messageKey) ? error.messageKey : INTERNAL_KEY;
  return { messageKey, gaps: readGaps(error.details), removed: readRemoved(error.details) };
}
