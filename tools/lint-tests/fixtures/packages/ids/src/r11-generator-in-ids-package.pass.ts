import { randomUUID } from "node:crypto";

export function makeNativeId(): string {
  return randomUUID() + globalThis.crypto.randomUUID();
}
