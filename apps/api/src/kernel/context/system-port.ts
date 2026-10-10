import type { SystemReason } from "@banijjik/contracts";
import { runAsSystem } from "./run-as-system.js";

/**
 * Wraps a port so that each method call runs inside runAsSystem(reason). Only the composition
 * root (routes/v1.ts) may use it: modules never hold a bypass, and every decision to let a plain
 * module port run as system sits in one reviewable file (ADR-087). Lint R27 keeps it out of modules.
 * Every method of the port must return a promise.
 */
export function asSystemPort<Port extends object>(
  reason: SystemReason,
  implementation: Port,
): Port {
  return new Proxy(implementation, {
    get(target, property) {
      const member: unknown = Reflect.get(target, property, target);
      if (typeof member !== "function") return member;
      return (...args: unknown[]) =>
        runAsSystem(reason, async () => Reflect.apply(member, target, args));
    },
  });
}
