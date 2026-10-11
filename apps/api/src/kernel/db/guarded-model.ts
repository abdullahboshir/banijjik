import { ERROR_CODE, SYSTEM_REASON } from "@banijjik/contracts";
import { getSystemReason } from "../context/index.js";
import { AppError } from "../http/app-error.js";

/**
 * Review finding J2. Mongoose skips every hook when a query, aggregate or document call carries
 * `middleware: false` (`pre({ middleware: false })` in `buildMiddlewareFilter`), and the tenant
 * filter and the append-only guard are hooks. A hook cannot see that it is being skipped, so the
 * model handed out by `models(ctx).get()` is wrapped once: every entry point that accepts the
 * option throws `errors.middleware_bypass_forbidden` unless the call runs under
 * `runAsSystem(MIGRATION)`. The list of wrapped paths is in docs/handoffs/1.9b.md; the tests in
 * tenancy/middleware-bypass.test.ts pin it, so a Mongoose upgrade that adds a path fails loudly.
 */

const SKIP_OPTION = "middleware";
const OPTIONS_ARGUMENT = 1;

/** Statics that take `(documents, options)`; all return a promise. */
const STATICS_WITH_OPTIONS = ["insertMany", "bulkWrite", "bulkSave", "create", "insertOne"];
/** Document methods whose first argument is the options object; all return a promise. */
const ASYNC_DOCUMENT_METHODS = ["save", "$save", "$__save"];
/** `validate(options)` and `validate(paths, options)` are both valid, so every argument is checked. */
const VALIDATE_METHODS = ["validate", "$validate"];

type Inspector = (self: unknown, args: readonly unknown[]) => void;

function bypassForbidden(): AppError {
  return new AppError({
    code: ERROR_CODE.INTERNAL,
    messageKey: "errors.middleware_bypass_forbidden",
  });
}

function isPhaseSkipped(value: unknown): boolean {
  if (value === false) return true;
  if (typeof value !== "object" || value === null) return false;
  return Reflect.get(value, "pre") === false || Reflect.get(value, "post") === false;
}

/** Mirrors Mongoose: `middleware: false`, or `{ pre: false }` / `{ post: false }`. */
function requestsHookSkip(options: unknown): boolean {
  if (typeof options !== "object" || options === null) return false;
  return isPhaseSkipped(Reflect.get(options, SKIP_OPTION));
}

/** Only a data migration may run without the hooks, as for the append-only guard. */
function assertHooksNotSkipped(options: unknown): void {
  if (!requestsHookSkip(options)) return;
  if (getSystemReason() === SYSTEM_REASON.MIGRATION) return;
  throw bypassForbidden();
}

function missingTarget(name: string): AppError {
  return new AppError({
    code: ERROR_CODE.INTERNAL,
    messageKey: "errors.middleware_guard_target_missing",
    details: { name },
  });
}

/** Replaces `target[name]` with a function that runs `inspect` first. A missing method throws: a silent skip would be a partial guard. */
interface Guard {
  readonly inspect: Inspector;
  /** A refusal becomes a rejected promise, as the original method would have failed. */
  readonly returnsPromise: boolean;
}

function synchronous(inspect: Inspector): Guard {
  return { inspect, returnsPromise: false };
}

function asynchronous(inspect: Inspector): Guard {
  return { inspect, returnsPromise: true };
}

/** Replaces `target[name]` with a function that inspects the call first. A missing method throws: a silent skip would be a partial guard. */
function wrapMethod(target: object, name: string, guard: Guard): void {
  const original: unknown = Reflect.get(target, name);
  if (typeof original !== "function") throw missingTarget(name);
  Reflect.set(target, name, function guarded(this: unknown, ...args: unknown[]): unknown {
    try {
      guard.inspect(this, args);
    } catch (error) {
      if (guard.returnsPromise) return Promise.reject(error);
      throw error;
    }
    return Reflect.apply(original, this, args);
  });
}

function inspectArgument(index: number): Inspector {
  return (_self, args) => assertHooksNotSkipped(args[index]);
}

function inspectAllArguments(_self: unknown, args: readonly unknown[]): void {
  for (const argument of args) assertHooksNotSkipped(argument);
}

/** Queries and aggregates keep their options on `this.options`, which callers can also assign directly. */
function inspectOwnOptions(self: unknown): void {
  if (typeof self === "object" && self !== null) {
    assertHooksNotSkipped(Reflect.get(self, "options"));
  }
}

function inspectOptionsAndArgument(self: unknown, args: readonly unknown[]): void {
  inspectOwnOptions(self);
  assertHooksNotSkipped(args[0]);
}

function guardAggregate(aggregate: unknown): void {
  if (typeof aggregate !== "object" || aggregate === null) return;
  wrapMethod(aggregate, "option", synchronous(inspectArgument(0)));
  wrapMethod(aggregate, "cursor", synchronous(inspectOptionsAndArgument));
  wrapMethod(aggregate, "exec", asynchronous(inspectOwnOptions));
  wrapMethod(aggregate, "explain", asynchronous(inspectOwnOptions));
}

function guardAggregateStatic(model: object): void {
  const original: unknown = Reflect.get(model, "aggregate");
  if (typeof original !== "function") throw missingTarget("aggregate");
  Reflect.set(model, "aggregate", function guarded(this: unknown, ...args: unknown[]): unknown {
    assertHooksNotSkipped(args[OPTIONS_ARGUMENT]);
    const aggregate: unknown = Reflect.apply(original, this, args);
    guardAggregate(aggregate);
    return aggregate;
  });
}

function guardQueries(model: object): void {
  const queryClass: unknown = Reflect.get(model, "Query");
  const queryPrototype: unknown =
    typeof queryClass === "function" ? Reflect.get(queryClass, "prototype") : undefined;
  if (typeof queryPrototype !== "object" || queryPrototype === null) throw missingTarget("Query");
  wrapMethod(queryPrototype, "setOptions", synchronous(inspectArgument(0)));
  wrapMethod(queryPrototype, "cursor", synchronous(inspectOptionsAndArgument));
  wrapMethod(queryPrototype, "exec", asynchronous(inspectOwnOptions));
}

function guardStatics(model: object): void {
  guardAggregateStatic(model);
  for (const name of STATICS_WITH_OPTIONS) {
    wrapMethod(model, name, asynchronous(inspectArgument(OPTIONS_ARGUMENT)));
  }
}

function guardDocuments(model: object): void {
  const documentPrototype: unknown = Reflect.get(model, "prototype");
  if (typeof documentPrototype !== "object" || documentPrototype === null) {
    throw missingTarget("prototype");
  }
  for (const name of ASYNC_DOCUMENT_METHODS) {
    wrapMethod(documentPrototype, name, asynchronous(inspectArgument(0)));
  }
  for (const name of VALIDATE_METHODS) {
    wrapMethod(documentPrototype, name, asynchronous(inspectAllArguments));
  }
  wrapMethod(documentPrototype, "deleteOne", synchronous(inspectArgument(0)));
  wrapMethod(documentPrototype, "updateOne", synchronous(inspectArgument(OPTIONS_ARGUMENT)));
}

/** Call once on a freshly compiled model; `models()` does it for every tenant-scoped or append-only model. */
export function guardAgainstMiddlewareBypass(model: object): void {
  guardQueries(model);
  guardStatics(model);
  guardDocuments(model);
}
