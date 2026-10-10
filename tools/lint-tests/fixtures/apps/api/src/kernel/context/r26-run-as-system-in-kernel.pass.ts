import { runAsSystem } from "./index.js";

export async function readEverything(): Promise<number> {
  return runAsSystem("AUTH_LOOKUP", async () => 1);
}
