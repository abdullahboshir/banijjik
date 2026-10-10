import type { LimitKey } from "../entitlement/limit-key.js";
import type { EventType } from "../events/event-type.js";
import type { PermissionDefinition } from "../iam/permission-definition.js";
import type { PermissionKey } from "../iam/permission-key.js";
import type { Surface } from "../iam/surface.js";
import type { SequenceKey } from "../system/sequence-key.js";
import type { ModuleClass } from "./module-class.js";
import type { ModuleKey } from "./module-key.js";
import type { OfferingKind } from "./offering-kind.js";

/** One entry of the admin menu (10-MODULE-CATALOG section 6). Labels come from terms or message keys, never literals. */
export interface MenuEntry {
  readonly menuKey: string;
  readonly surface: Surface;
  readonly groupKey: string;
  readonly labelTermKey: string;
  readonly path: string;
  readonly iconKey: string;
  readonly permissionKey: PermissionKey;
  readonly order: number;
  /** The entry shows only while this kind is effective. */
  readonly requiresKind?: OfferingKind;
}

/** Route path prefixes by surface. A prefix is a full v1 path such as `/orgs/:organizationId/roles`. */
export interface ModuleRoutes {
  readonly admin?: readonly string[];
  readonly storefront?: readonly string[];
  readonly platform?: readonly string[];
  readonly webhook?: readonly string[];
}

/**
 * What a module declares about itself (10-MODULE-CATALOG section 2). The manifest is the only
 * place routes, permissions, menu entries and events live. The setting, field, bot tool and
 * section key types arrive with the cards that define those registries; until then they are strings.
 */
export interface ModuleManifest {
  readonly key: ModuleKey;
  readonly path: string;
  readonly moduleClass: ModuleClass;
  readonly dependsOn: readonly ModuleKey[];
  readonly providesKinds: readonly OfferingKind[];
  readonly requiresAnyKind: readonly OfferingKind[];
  readonly tenantCanDisable: boolean;
  readonly permissions: readonly PermissionDefinition[];
  readonly routes: ModuleRoutes;
  readonly menu: readonly MenuEntry[];
  readonly settingKeys: readonly string[];
  readonly customFieldEntities: readonly string[];
  readonly botTools: readonly string[];
  readonly storefrontSections: readonly string[];
  readonly events: {
    readonly emits: readonly EventType[];
    readonly consumes: readonly EventType[];
  };
  readonly limitKeys: readonly LimitKey[];
  readonly sequenceKeys: readonly SequenceKey[];
}
