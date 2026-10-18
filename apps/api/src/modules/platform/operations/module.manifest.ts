import { MODULE_CLASS, MODULE_KEY } from "@banijjik/contracts";
import { defineModule } from "../../../kernel/modules/index.js";

/**
 * The operations manifest (card 3.8a, ADR-115). A PLATFORM module: the failed-events screens of the
 * platform panel. It owns no data of its own; the dead letters and the outbox belong to the event
 * kernel, and this module is the operator's way to replay or skip what did not get through.
 */
export const operationsManifest = defineModule({
  key: MODULE_KEY.OPERATIONS,
  path: "platform/operations",
  moduleClass: MODULE_CLASS.PLATFORM,
  dependsOn: [],
  providesKinds: [],
  requiresAnyKind: [],
  tenantCanDisable: false,
  permissions: [],
  routes: { platform: ["/platform/event-dead-letters", "/platform/dead-outbox-events"] },
  menu: [],
  settings: [],
  customFieldEntities: [],
  botTools: [],
  storefrontSections: [],
  events: { emits: [], consumes: [] },
  limitKeys: [],
  sequenceKeys: [],
});
