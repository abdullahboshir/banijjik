import type { ModuleKey } from "@banijjik/contracts";

export interface CourierInfo {
  readonly moduleKey: ModuleKey;
  readonly path: string;
}

/** Where the module reads its own identity from. The infrastructure layer implements it. */
export interface CourierInfoSource {
  read(): CourierInfo;
}
