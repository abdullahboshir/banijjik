import type { ModuleKey } from "@banijjik/contracts";
import type { ApiActor } from "../two-organizations.js";

/**
 * How the suite reaches the data a module owns (assertion 7 of 10-MODULE-CATALOG section 11). The
 * model registry does not say which module owns a model, so the test names them; the suite then
 * counts the documents of the organization before and after a module is turned off.
 */
export interface ModuleDataAccess {
  /** Registered model names the module owns. A module with none has no data to protect. */
  modelNames(moduleKey: ModuleKey): readonly string[];
  /** Puts one document of the organization into the model, so a delete would be seen. */
  seed(organizationId: string, modelName: string): Promise<void>;
  count(organizationId: string, modelName: string): Promise<number>;
}

/** A signed-in person who can call the API under test. `ApiActor` fits it. */
export interface ContractCaller {
  call(
    method: "get" | "post" | "put" | "patch" | "delete",
    path: string,
    body?: object,
  ): Promise<{ readonly status: number; readonly body: Record<string, unknown> }>;
}

/** The organization a contract scenario runs in, and the person who owns it. */
export interface ContractOrganization {
  readonly organizationId: string;
  readonly owner: ApiActor;
}
