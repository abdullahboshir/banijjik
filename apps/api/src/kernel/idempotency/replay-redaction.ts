import type { Response } from "express";

const REDACTED_FIELDS_LOCAL = "idempotencyRedactedFields";

/**
 * A handler calls this when its answer carries a secret that must not be stored in the idempotency
 * record (the invitation link). The first response keeps the field; a replay of the same key
 * returns the stored answer without it ("returned once").
 */
export function redactFromReplay(response: Response, dataFields: readonly string[]): void {
  response.locals[REDACTED_FIELDS_LOCAL] = dataFields;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function redactedFieldsOf(response: Response): readonly string[] {
  const fields: unknown = response.locals[REDACTED_FIELDS_LOCAL];
  return Array.isArray(fields)
    ? fields.filter((field: unknown): field is string => typeof field === "string")
    : [];
}

/** The body to store for replays: the sent body minus the fields the handler asked to redact from `data`. */
export function bodyToStore(response: Response, body: unknown): unknown {
  const fields = redactedFieldsOf(response);
  if (fields.length === 0 || !isRecord(body) || !isRecord(body["data"])) return body;
  const data = Object.fromEntries(
    Object.entries(body["data"]).filter(([key]) => !fields.includes(key)),
  );
  return { ...body, data };
}
