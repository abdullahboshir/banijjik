import {
  LIMIT_KEY_VALUES,
  MODULE_CLASS,
  PACKAGE_STATUS,
  type ModuleKey,
  type ModuleOverrideEffect,
} from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { withTransaction } from "../../kernel/db/index.js";
import type { ModuleRegistry } from "../../kernel/modules/index.js";
import { buildConfigVersionBumper } from "../../modules/core/organization/index.js";
import {
  buildOrgConfigService,
  type EffectiveOrgConfig,
  type OrgConfigService,
} from "../../modules/platform/entitlement/index.js";
import {
  buildOrganizationConfigPorts,
  buildResolvedConfigSources,
} from "../../routes/organization-config-ports.js";
import { registerViaApi } from "../auth-api-scenarios.js";
import { writeModuleOverride } from "../entitlement-world.js";
import type { IamApiHarness } from "../iam-api-harness.js";
import { withOrganizationContext } from "../organization-context.js";
import { ApiActor } from "../two-organizations.js";
import type { ContractTemplateReader } from "./contract-template-reader.js";
import type { ContractOrganization } from "./contract-types.js";

export interface ContractWorldOptions {
  readonly harness: IamApiHarness;
  readonly registry: ModuleRegistry;
  readonly templateReader: ContractTemplateReader;
  /** The extra fields of the create-organization body (lint R16 keeps the industry template key in the test file). */
  readonly organizationFields: object;
}

/** The module keys a package can sell: CORE and OPTIONAL ones. SYSTEM is implicit and PLATFORM is not tenant-facing. */
function sellableKeys(registry: ModuleRegistry): ModuleKey[] {
  return registry
    .all()
    .filter(
      (manifest) =>
        manifest.moduleClass === MODULE_CLASS.CORE ||
        manifest.moduleClass === MODULE_CLASS.OPTIONAL,
    )
    .map((manifest) => manifest.key);
}

function unlimitedLimits(): Record<string, number | null> {
  return Object.fromEntries(LIMIT_KEY_VALUES.map((limitKey) => [limitKey, null]));
}

/**
 * Builds the organizations the contract scenarios run in. Every organization starts on a package
 * that holds every sellable module, so a module is effective until a scenario turns it off.
 */
export class ContractWorld {
  readonly orgConfig: OrgConfigService;
  private readonly packageIds = new Map<string, string>();
  private issuedSlugs = 0;

  constructor(private readonly options: ContractWorldOptions) {
    const { registry, harness, templateReader } = options;
    this.orgConfig = buildOrgConfigService({
      registry,
      clock: harness.clock,
      ...buildOrganizationConfigPorts(),
      ...buildResolvedConfigSources(registry),
      templates: templateReader,
    });
  }

  get harness(): IamApiHarness {
    return this.options.harness;
  }

  get templateReader(): ContractTemplateReader {
    return this.options.templateReader;
  }

  get registry(): ModuleRegistry {
    return this.options.registry;
  }

  async createOrganization(): Promise<ContractOrganization> {
    const { harness, organizationFields } = this.options;
    this.issuedSlugs += 1;
    const owner = new ApiActor(harness.app, await registerViaApi(harness.app));
    const response = await owner.call("post", "/me/orgs", {
      name: "Contract Shop",
      slug: `contract-shop-${this.issuedSlugs}`,
      ...organizationFields,
    });
    if (response.status !== 201) throw new Error(`organization failed: ${response.status}`);
    const organizationId = response.body.data.organizationId as string;
    await this.switchPackage(organizationId, "CONTRACT_ALL", sellableKeys(this.registry));
    return { organizationId, owner };
  }

  /** Moves the organization to a package that sells every module except `moduleKey`. */
  async removeFromPackage(organizationId: string, moduleKey: ModuleKey): Promise<void> {
    const keys = sellableKeys(this.registry).filter((key) => key !== moduleKey);
    await this.switchPackage(organizationId, `CONTRACT_WITHOUT_${moduleKey}`, keys);
  }

  async override(
    organizationId: string,
    moduleKey: ModuleKey,
    effect: ModuleOverrideEffect,
  ): Promise<void> {
    await writeModuleOverride({ organizationId, moduleKey, effect });
  }

  /** The resolved config straight from the service: it carries the lists `/me/config` does not (bot tools, sections, fields). */
  async resolvedConfig(organizationId: string): Promise<EffectiveOrgConfig["config"]> {
    const effective = await withOrganizationContext(organizationId, () =>
      this.orgConfig.forOrganization(organizationId),
    );
    return effective.config;
  }

  private async switchPackage(
    organizationId: string,
    packageKey: string,
    moduleKeys: readonly ModuleKey[],
  ): Promise<void> {
    const packageId = await this.ensurePackage(packageKey, moduleKeys);
    await this.harness.connections.platform
      .collection("platform_subscriptions")
      .updateOne({ organizationId }, { $set: { basePackageId: packageId } });
    await withOrganizationContext(organizationId, () =>
      withTransaction(() => buildConfigVersionBumper().bump(organizationId)),
    );
  }

  /** Packages are written as raw rows, like the existing entitlement tests do for catalogue edits. */
  private async ensurePackage(
    packageKey: string,
    moduleKeys: readonly ModuleKey[],
  ): Promise<string> {
    const known = this.packageIds.get(packageKey);
    if (known !== undefined) return known;
    const packageId = newId();
    const now = this.harness.clock.now();
    await this.harness.connections.platform.collection("packages").insertOne({
      packageId,
      packageKey: packageKey.replaceAll("-", "_").toUpperCase(),
      nameKey: `package.${packageKey}`,
      isAddOn: false,
      moduleKeys: [...moduleKeys],
      limits: unlimitedLimits(),
      limitIncrements: {},
      status: PACKAGE_STATUS.ACTIVE,
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdByUserId: null,
      updatedByUserId: null,
    });
    this.packageIds.set(packageKey, packageId);
    return packageId;
  }
}
