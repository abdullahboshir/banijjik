import { afterAll, beforeAll } from "vitest";
import { MODULE_MANIFESTS, buildModuleRegistry } from "../routes/module-registry.js";
import { registerIamApiModels, startIamApi } from "../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../test-support/iam-api-harness.js";
import { ContractTemplateReader } from "../test-support/module-contract/contract-template-reader.js";
import { describeModuleContracts } from "../test-support/module-contract/describe-module-contracts.js";
import {
  buildContractProbeRouter,
  CONTRACT_PROBE_MANIFESTS,
  contractProbeData,
  registerContractProbeModels,
} from "../test-support/module-contract/probe-modules.js";
import { KERNEL_PROBE_MANIFEST } from "../test-support/probe-manifests.js";

registerIamApiModels();
registerContractProbeModels();

const templateReader = new ContractTemplateReader();
let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi({
    tenantRouters: [buildContractProbeRouter()],
    extraManifests: CONTRACT_PROBE_MANIFESTS,
    templateReader,
  });
});

afterAll(async () => {
  await harness.dispose();
});

// The production manifests plus the probe modules that stand in for the CORE and OPTIONAL modules
// that do not exist yet. A module added to MODULE_MANIFESTS is covered here with no further code.
describeModuleContracts({
  registry: buildModuleRegistry([KERNEL_PROBE_MANIFEST, ...CONTRACT_PROBE_MANIFESTS]),
  productionKeys: new Set(MODULE_MANIFESTS.map((manifest) => manifest.key)),
  harness: () => harness,
  templateReader,
  moduleData: contractProbeData,
  organizationFields: { industryTemplateKey: "RETAIL" },
});
