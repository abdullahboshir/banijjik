export interface LoggableError {
  readonly name: string;
  readonly message: string;
  readonly code?: unknown;
  readonly stack?: string | undefined;
  readonly messageKey?: unknown;
  readonly details?: unknown;
}

/** Driver errors (duplicate key, validation) carry the offending user data in these fields and in their message. */
const USER_DATA_FIELDS = ["keyValue", "keyPattern", "errInfo"] as const;

type ErrorFields = Readonly<Record<string, unknown>>;

function carriesUserData(fields: ErrorFields): boolean {
  return USER_DATA_FIELDS.some((field) => field in fields);
}

/** The stack's first line repeats the message, so it is cut off together with the message. */
function stackWithoutMessage(stack: string | undefined): string | undefined {
  return stack
    ?.split("\n")
    .filter((line) => line.trimStart().startsWith("at "))
    .join("\n");
}

function describeDriverError(error: Error, fields: ErrorFields): LoggableError {
  return {
    name: error.name,
    message: `${error.name} ${String(fields["code"] ?? "")}`.trim(),
    code: fields["code"],
    stack: stackWithoutMessage(error.stack),
  };
}

/**
 * What an error log line may contain (review finding M6). Plain errors keep name, message, code
 * and stack. Driver errors that carry user data keep only their name, code and the stack frames.
 */
export function toLoggableError(error: unknown): LoggableError {
  if (!(error instanceof Error)) return { name: "NonError", message: String(error) };
  const fields: ErrorFields = { ...error };
  if (carriesUserData(fields)) return describeDriverError(error, fields);
  return {
    name: error.name,
    message: error.message,
    code: fields["code"],
    stack: error.stack,
    messageKey: fields["messageKey"],
    details: fields["details"],
  };
}
