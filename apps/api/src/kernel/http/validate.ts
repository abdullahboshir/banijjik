import type { Request, RequestHandler } from "express";
import { VALIDATION_FALLBACK_MESSAGE_KEY, VALIDATION_MESSAGE_KEYS } from "@banijjik/contracts";
import type { ZodType } from "zod";
import { validationFailed, type ValidationField } from "./app-error.js";

export interface ValidationSchemas {
  readonly params?: ZodType;
  readonly query?: ZodType;
  readonly body?: ZodType;
}

type RequestPart = keyof ValidationSchemas;
const REQUEST_PARTS: readonly RequestPart[] = ["params", "query", "body"];

/** A Zod issue code the catalogs cannot translate becomes validation.custom (review finding J2). */
function toMessageKey(code: string): string {
  const messageKey = `validation.${code}`;
  return VALIDATION_MESSAGE_KEYS.includes(messageKey)
    ? messageKey
    : VALIDATION_FALLBACK_MESSAGE_KEY;
}

/** Only the issue code is used: Zod's English text can echo the submitted value. */
function toFields(path: readonly PropertyKey[], code: string): ValidationField {
  return { path: path.map(String).join("."), messageKey: toMessageKey(code) };
}

interface PartResult {
  readonly value: unknown;
  readonly fields: readonly ValidationField[];
}

function parsePart(schema: ZodType | undefined, raw: unknown): PartResult {
  if (schema === undefined) return { value: raw, fields: [] };
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { value: parsed.data, fields: [] };
  return {
    value: raw,
    fields: parsed.error.issues.map((issue) => toFields(issue.path, issue.code)),
  };
}

function readPart(request: Request, part: RequestPart): unknown {
  return request[part];
}

/**
 * Validates params, query and body once (ADR-012). Parsed values are always in
 * `response.locals.validated`, because Express 5 makes `request.query` read-only.
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (request, response, next) => {
    const fields: ValidationField[] = [];
    const validated: Record<RequestPart, unknown> = {
      params: undefined,
      query: undefined,
      body: undefined,
    };
    for (const part of REQUEST_PARTS) {
      const result = parsePart(schemas[part], readPart(request, part));
      validated[part] = result.value;
      fields.push(...result.fields);
    }
    if (fields.length > 0) throw validationFailed(fields);
    // Safe: the params schema produced this value; Express only types params as strings.
    request.params = validated.params as Request["params"];
    request.body = validated.body;
    response.locals["validated"] = validated;
    next();
  };
}
