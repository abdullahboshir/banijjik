import { rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Removes `<packageFolder>/dist`, so a build never ships files an earlier build left behind. */
export function cleanDist(packageFolder) {
  rmSync(join(packageFolder, "dist"), { recursive: true, force: true });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  cleanDist(process.cwd());
}
