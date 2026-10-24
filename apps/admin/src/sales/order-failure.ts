import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";

export interface RuleFailure {
  readonly message: string;
  readonly ruleKey: string | undefined;
}

type Translate = (key: string) => string;

export function messageOf(error: unknown, t: Translate): string {
  if (error instanceof ApiError) return t(knownMessageKeyOrInternal(error.messageKey));
  if (error instanceof Error) return error.message;
  return t("errors.internal");
}

export function ruleKeyOf(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  const ruleKey = error.details?.["ruleKey"];
  return typeof ruleKey === "string" ? ruleKey : undefined;
}

export function failureOf(error: unknown, t: Translate): RuleFailure {
  return { message: messageOf(error, t), ruleKey: ruleKeyOf(error) };
}
