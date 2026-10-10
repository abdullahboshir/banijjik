import { runAsSystem } from "../kernel/context/index.js";

export const seedPlatformData = (): Promise<void> => runAsSystem("SEED", async () => undefined);
