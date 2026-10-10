// Writes src/styles/tokens.css from the TypeScript tokens. Runs after tsc in `build`
// because the generator lives in src/tokens/render-css.ts and is imported from dist.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderTokensCss } from "../dist/tokens/render-css.js";

const outputPath = fileURLToPath(new URL("../src/styles/tokens.css", import.meta.url));
writeFileSync(outputPath, renderTokensCss());
