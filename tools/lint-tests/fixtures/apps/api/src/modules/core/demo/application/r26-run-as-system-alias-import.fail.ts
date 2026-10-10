import { runAsSystem as elevate } from "../../../../kernel/context/index.js";

export async function readEverything(): Promise<number> {
  return elevate("AUTH_LOOKUP", async () => 1);
}
