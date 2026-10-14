import { cpSync } from "node:fs";
import { join } from "node:path";

const SOURCE = join("src", "modules", "platform", "industry", "infrastructure", "seeds");
const DESTINATION = join("dist", "modules", "platform", "industry", "infrastructure", "seeds");

/**
 * `tsc` does not emit JSON. The built API (`node dist/main.js`, including the browser stack)
 * reads the seed files from next to the compiled loader, so the build copies them after compile.
 */
cpSync(SOURCE, DESTINATION, { recursive: true });
