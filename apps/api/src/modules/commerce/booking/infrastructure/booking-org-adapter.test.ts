import { ERROR_CODE } from "@banijjik/contracts";
import { asId, type OrganizationId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { models } from "../../../../kernel/db/index.js";
import { runInOrganizationContext } from "../../../../kernel/tenancy/index.js";
import { startCatalogApi, worldFor } from "../../../../test-support/catalog-world.js";
import {
  registerIamApiModels,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import { buildOrganizationTimezoneReader } from "./booking-org-adapter.js";

registerIamApiModels();

let harness: IamApiHarness;
beforeAll(async () => {
  harness = await startCatalogApi();
});
afterAll(async () => {
  await harness.dispose();
});

describe("booking organization time zone reader", () => {
  it("reads the stored time zone of the organization", async () => {
    const world = await worldFor(harness, { industryTemplateKey: "RETAIL" });
    const organizationId = asId<OrganizationId>(world.organizationA);
    const timezone = await runInOrganizationContext(world.organizationA, () =>
      buildOrganizationTimezoneReader().read(organizationId),
    );
    expect(timezone).toBeTruthy();
  });

  it("booking time zone reader fails when the organization has no time zone", async () => {
    const world = await worldFor(harness, { industryTemplateKey: "RETAIL" });
    const organizationId = asId<OrganizationId>(world.organizationA);
    await runInOrganizationContext(world.organizationA, async () => {
      await models({})
        .get("Organization")
        .updateOne({ organizationId }, { $unset: { timezone: 1 } });
      await expect(buildOrganizationTimezoneReader().read(organizationId)).rejects.toMatchObject({
        code: ERROR_CODE.NOT_FOUND,
      });
    });
  });
});
