import type { ModuleManifest } from "@banijjik/contracts";
import type {
  CourierInfo,
  CourierInfoSource,
} from "../application/ports/courier-info.source.js";

/** Reads the identity of the module from its manifest. */
export class ManifestCourierInfoSource implements CourierInfoSource {
  constructor(private readonly manifest: Pick<ModuleManifest, "key" | "path">) {}

  read(): CourierInfo {
    return { moduleKey: this.manifest.key, path: this.manifest.path };
  }
}
