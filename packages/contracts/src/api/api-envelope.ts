import { ERROR_CODE, type ErrorCode } from "../errors/error-code.js";

/** The body of a failed call (14-API.md section 2). */
export interface ApiErrorBody {
  code: ErrorCode;
  messageKey: string;
  details?: Readonly<Record<string, unknown>>;
  requestId: string;
}

export interface ApiErrorEnvelope {
  error: ApiErrorBody;
}

export interface ApiSuccessEnvelope<Data, Meta = Readonly<Record<string, unknown>>> {
  data: Data;
  meta?: Meta;
}

const ERROR_CODE_VALUES: ReadonlySet<string> = new Set(Object.values(ERROR_CODE));

/** Narrows a string from the wire; an unknown code must never be trusted as an ErrorCode. */
export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && ERROR_CODE_VALUES.has(value);
}
