import { MODULE_FILES, SYSTEM_ACCESS_FILES, TEST_FILES } from "./scopes.mjs";
import { middlewareBypassSelectors, syntaxRules } from "./selectors.mjs";

const ERROR = "error";
// runAsSystem and runWithRequestContext are exported by the kernel; whatever path or alias reaches the kernel is covered.
// A namespace import (`import * as x`) from the kernel is reported too, because importNames cannot tell which names it uses.
const KERNEL_MODULES = ["**/kernel", "**/kernel/**"];

/** Rules that stop module code from skipping the tenant plugin (ADR-087): system access, request context, raw collections, the middleware option. */
export const bypassBlocks = [
  {
    name: "banijjik/run-as-system",
    files: MODULE_FILES,
    ignores: [...SYSTEM_ACCESS_FILES, ...TEST_FILES],
    rules: {
      // The call is banned under any name: the import by name (aliases included) and a member call.
      "banijjik-guard/no-run-as-system": [
        ERROR,
        ...syntaxRules(
          "runAsSystem is for the kernel and platform use cases only; module code stays tenant-scoped (05-CONVENTIONS System access).",
          [
            "CallExpression[callee.name='runAsSystem']",
            "CallExpression[callee.property.name='runAsSystem']",
          ],
        ),
      ],
      "banijjik-guard/no-run-as-system-import": [
        ERROR,
        {
          patterns: [
            {
              group: KERNEL_MODULES,
              importNames: ["runAsSystem"],
              message:
                "runAsSystem is for the kernel and platform use cases only; module code stays tenant-scoped (05-CONVENTIONS System access).",
            },
          ],
        },
      ],
    },
  },
  {
    name: "banijjik/request-context",
    files: MODULE_FILES,
    ignores: TEST_FILES,
    rules: {
      // Building a request context by hand would let module code claim any organization or user.
      "banijjik-guard/no-request-context-import": [
        ERROR,
        {
          patterns: [
            {
              group: KERNEL_MODULES,
              importNames: ["runWithRequestContext", "asSystemPort", "runInOrganizationContext"],
              message:
                "Only the kernel and routes/v1.ts create a request context or grant a bypass; module code reads the context with getRequestContext() and receives a plain port (ADR-087).",
            },
          ],
        },
      ],
    },
  },
  {
    name: "banijjik/raw-collection",
    files: MODULE_FILES,
    ignores: TEST_FILES,
    rules: {
      // Raw driver collections skip Mongoose middleware, so they would skip the tenant plugin too.
      "banijjik-guard/no-raw-collection": [
        ERROR,
        ...syntaxRules(
          "A raw driver collection bypasses the tenant plugin; use the models(ctx) accessor (ADR-087).",
          [
            "MemberExpression[computed=false][property.name='collection']",
            "MemberExpression[computed=true][property.value='collection']",
            // Change streams have no Mongoose middleware: Model.watch() would stream every organization.
            "CallExpression[callee.property.name='watch']",
          ],
        ),
      ],
    },
  },
  {
    name: "banijjik/middleware-bypass",
    files: MODULE_FILES,
    ignores: TEST_FILES,
    rules: {
      // Mongoose skips hooks (the tenant filter among them) when this option is set (finding J2).
      "banijjik-guard/no-middleware-bypass": [
        ERROR,
        ...syntaxRules(
          "The middleware option switches the tenant plugin off; there is no bypass in module code (ADR-087).",
          middlewareBypassSelectors,
        ),
      ],
    },
  },
];
