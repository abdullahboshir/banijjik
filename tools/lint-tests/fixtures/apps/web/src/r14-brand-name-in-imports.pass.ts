import { newId } from "@banijjik/ids";

export { defineEnum } from "@banijjik/contracts";
export type { Id } from "@banijjik/ids";

export function makeKey(): string {
  return newId();
}
