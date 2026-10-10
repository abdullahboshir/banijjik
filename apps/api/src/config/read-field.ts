import type { ConfigIssue } from "./app-config.js";
import type { FieldRule } from "./env.schema.js";

export type Environment = Readonly<Record<string, string | undefined>>;

export interface FieldResult<Output> {
  readonly value?: Output;
  readonly issue?: ConfigIssue;
}

export function failure(
  rule: FieldRule<unknown>,
  problem: ConfigIssue["problem"],
  hint: string = rule.hint,
): FieldResult<never> {
  return { issue: { key: rule.key, problem, hint } };
}

/** Reads one key. Zod's own messages are ignored because they can echo the value. */
export function readField<Output>(env: Environment, rule: FieldRule<Output>): FieldResult<Output> {
  const raw = env[rule.key]?.trim();
  const text = raw === undefined || raw === "" ? rule.defaultValue : raw;
  if (text === undefined) return failure(rule, "MISSING");
  const parsed = rule.schema.safeParse(text);
  if (!parsed.success) return failure(rule, "INVALID");
  return { value: parsed.data };
}

/** Like readField, but an unset or empty key is fine and gives no value. */
export function readOptionalField<Output>(
  env: Environment,
  rule: FieldRule<Output>,
): FieldResult<Output | undefined> {
  const raw = env[rule.key]?.trim();
  if (raw === undefined || raw === "") return {};
  return readField(env, rule);
}

export function collectIssues(results: readonly FieldResult<unknown>[]): ConfigIssue[] {
  return results.flatMap((result) => (result.issue ? [result.issue] : []));
}
