import { PLATFORM_ROLE } from "@banijjik/contracts";
import type { Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asCookies, callApi } from "../../../test-support/auth-api-client.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../test-support/iam-api-harness.js";
import { newActor } from "../../../test-support/organization-tenant-world.js";
import { createPlatformActor, type PlatformActor } from "../../../test-support/platform-world.js";
import { loadSeedIndustryTemplates } from "./infrastructure/load-seed-templates.js";

registerIamApiModels();

const ROUNDS = 8;

let harness: IamApiHarness;
let operator: PlatformActor;
let round = 0;

beforeAll(async () => {
  harness = await startIamApi();
  operator = await createPlatformActor(harness.app, harness.connections, [
    PLATFORM_ROLE.SUPER_ADMIN,
  ]);
});

afterAll(async () => {
  if (harness !== undefined) await harness.dispose();
});

async function publishRetailClone(industryTemplateKey: string): Promise<{
  industryTemplateId: string;
  version: number;
}> {
  const source = loadSeedIndustryTemplates().find(
    (entry) => entry.industryTemplateKey === "RETAIL",
  );
  if (source === undefined) throw new Error("RETAIL seed missing");
  const created = await operator.call("post", "/industry-templates", {
    industryTemplateKey,
    name: source.name,
    description: source.description,
    iconKey: source.iconKey,
    reason: "race template",
    enabledKinds: source.enabledKinds,
    allowedModuleKeys: source.allowedModuleKeys,
    configuration: source.configuration,
  });
  const published = await operator.call(
    "post",
    `/industry-templates/${created.body.data.industryTemplateId}/publish`,
    { version: created.body.data.version, reason: "publish for the race" },
  );
  return {
    industryTemplateId: published.body.data.industryTemplateId as string,
    version: published.body.data.version as number,
  };
}

/** Supertest sends a request when `end` is called, which is early enough to overlap retire. */
function startSignup(
  owner: Awaited<ReturnType<typeof newActor>>,
  roundNumber: number,
  key: string,
): Promise<Response> {
  const pending = callApi(harness.app, {
    method: "post",
    path: "/api/v1/me/orgs",
    cookies: asCookies(owner.person.session),
    body: {
      name: `Race ${roundNumber}`,
      slug: `race-shop-${roundNumber}`,
      industryTemplateKey: key,
    },
  });
  return new Promise((resolve, reject) => {
    pending.end((error, response) => {
      if (error) reject(error);
      else resolve(response);
    });
  });
}

describe("signup and retire of the same template", () => {
  it("never leaves an organization on a template that was retired before the signup committed", async () => {
    for (let index = 0; index < ROUNDS; index += 1) {
      round += 1;
      const industryTemplateKey = `RACE_SHOP_${round}`;
      const template = await publishRetailClone(industryTemplateKey);
      const owner = await newActor(harness.app);
      const signupPromise = startSignup(owner, round, industryTemplateKey);
      // Long enough for signup to pass its cheap read and enter the transaction.
      await new Promise((resolve) => setTimeout(resolve, 20));
      const [signup, retired] = await Promise.all([
        signupPromise,
        operator.call("post", `/industry-templates/${template.industryTemplateId}/retire`, {
          version: template.version,
          reason: "retire during signup",
        }),
      ]);
      const organizations = await harness.connections.platform
        .collection("organizations")
        .find({ industryTemplateKey })
        .toArray();
      const stored = await harness.connections.platform
        .collection("industry_templates")
        .findOne({ industryTemplateKey });
      const referenceVersion = Number(stored?.["referenceVersion"] ?? 0);

      expect(retired.status).toBe(200);
      expect(stored?.["status"]).toBe("RETIRED");
      if (signup.status === 201) {
        expect(organizations).toHaveLength(1);
        expect(referenceVersion).toBeGreaterThanOrEqual(1);
      } else {
        expect(signup.status).toBe(422);
        expect(organizations).toHaveLength(0);
      }
    }
  });
});
