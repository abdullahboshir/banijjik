/**
 * Mongoose runs a hook carrying this symbol even when a call passes `middleware: false`: its own
 * built-in hooks (timestamps, subdocument saves) use it (`buildMiddlewareFilter`, Mongoose 9.11).
 * The tenant, location and append-only hooks are marked the same way, so skipping them is not
 * possible at all, not even by changing `query.options` after the call started (finding J2).
 * The wrappers in guarded-model.ts still refuse the option loudly; this is the layer behind them.
 * tenancy/middleware-bypass.test.ts pins the Mongoose behaviour, so an upgrade that drops it fails.
 */
const BUILT_IN_MIDDLEWARE = Symbol.for("mongoose:built-in-middleware");

/** Marks a hook function and returns it, so a schema.pre(...) call can take it unchanged. */
export function markUnskippable<Hook extends object>(hook: Hook): Hook {
  Reflect.set(hook, BUILT_IN_MIDDLEWARE, true);
  return hook;
}
