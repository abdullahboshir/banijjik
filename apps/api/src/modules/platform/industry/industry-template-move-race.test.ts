import { PLATFORM_ROLE } from "@banijjik/contracts";
import type { Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { callApi } from "../../../test-support/auth-api-client.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../test-support/iam-api-harness.js";
import { createOrganizationAs, newActor } from "../../../test-support/organization-tenant-world.js";
import {
  asPlatformCookies,
  createPlatformActor,
  type PlatformActor,
} from "../../../test-support/platform-world.js";
import { loadSeedIndustryTemplates } from "./infrastructure/load-seed-templates.js";

registerIamApiModels();

const ROUNDS = 8;
const OVERLAP_MILLISECONDS = 20;

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

function salonSeed() {
  const source = loadSeedIndustryTemplates().find((entry) => entry.industryTemplateKey === "SALON");
  if (source === undefined) throw new Error("SALON seed missing");
  return source;
}

async function createSalonCopy(industryTemplateKey: string): Promise<{
  industryTemplateId: string;
  version: number;
  allowedModuleKeys: readonly string[];
}> {
  const source = salonSeed();
  const created = await operator.call("post", "/industry-templates", {
    industryTemplateKey,
    name: source.name,
    description: source.description,
    iconKey: source.iconKey,
    reason: "move race template",
    enabledKinds: source.enabledKinds,
    allowedModuleKeys: source.allowedModuleKeys,
    configuration: source.configuration,
  });
  return {
    industryTemplateId: created.body.data.industryTemplateId as string,
    version: created.body.data.version as number,
    allowedModuleKeys: source.allowedModuleKeys,
  };
}

/** Supertest sends a request when `end` is called, so the move is in flight before retire or PATCH. */
function startMove(organizationId: string, industryTemplateKey: string): Promise<Response> {
  const pending = callApi(harness.app, {
    method: "post",
    path: `/api/v1/platform/organizations/${organizationId}/change-industry-template`,
    cookies: asPlatformCookies(operator.cookies),
    body: { industryTemplateKey, reason: "move during a template write" },
  });
  return new Promise((resolve, reject) => {
    pending.end((error, response) => {
      if (error) reject(error);
      else resolve(response);
    });
  });
}

async function organizationKey(organizationId: string): Promise<string> {
  const row = await harness.connections.platform
    .collection("organizations")
    .findOne({ organizationId });
  return String(row?.["industryTemplateKey"]);
}

async function templateRow(industryTemplateKey: string) {
  const row = await harness.connections.platform
    .collection("industry_templates")
    .findOne({ industryTemplateKey });
  return row;
}

describe("moving an organization while the target is written", () => {
  it("never moves onto a template that was retired before the move committed", async () => {
    for (let index = 0; index < ROUNDS; index += 1) {
      round += 1;
      const industryTemplateKey = `MOVE_RETIRE_${round}`;
      const target = await createSalonCopy(industryTemplateKey);
      await operator.call("post", `/industry-templates/${target.industryTemplateId}/publish`, {
        version: target.version,
        reason: "publish the move target",
      });
      const owner = await newActor(harness.app);
      const { organizationId } = await createOrganizationAs(owner, harness.connections, {
        industryTemplateKey: "RETAIL",
      });
      const movePromise = startMove(organizationId, industryTemplateKey);
      await new Promise((resolve) => setTimeout(resolve, OVERLAP_MILLISECONDS));
      const [moved, retired] = await Promise.all([
        movePromise,
        operator.call("post", `/industry-templates/${target.industryTemplateId}/retire`, {
          version: target.version + 1,
          reason: "retire during a move",
        }),
      ]);
      const stored = await templateRow(industryTemplateKey);
      const referenceVersion = Number(stored?.["referenceVersion"] ?? 0);
      const landed = (await organizationKey(organizationId)) === industryTemplateKey;

      expect(retired.status).toBe(200);
      expect(stored?.["status"]).toBe("RETIRED");
      if (landed) {
        expect(moved.status).toBe(200);
        expect(referenceVersion).toBeGreaterThanOrEqual(1);
      } else {
        expect(moved.status).toBe(422);
        expect(await organizationKey(organizationId)).toBe("RETAIL");
      }
    }
  });

  it("never drops booking from a draft and moves an organization onto that draft", async () => {
    for (let index = 0; index < ROUNDS; index += 1) {
      round += 1;
      const homeKey = `MOVE_HOME_${round}`;
      const draftKey = `MOVE_DRAFT_${round}`;
      const home = await createSalonCopy(homeKey);
      await operator.call("post", `/industry-templates/${home.industryTemplateId}/publish`, {
        version: home.version,
        reason: "publish the current template",
      });
      const draft = await createSalonCopy(draftKey);
      const owner = await newActor(harness.app);
      const { organizationId } = await createOrganizationAs(owner, harness.connections, {
        industryTemplateKey: homeKey,
      });
      const movePromise = startMove(organizationId, draftKey);
      // No pause: a head start lets the move commit before the PATCH is sent, so the count
      // alone refuses the removal and the document conflict is never exercised.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const [moved, patched] = await Promise.all([
        movePromise,
        operator.call("patch", `/industry-templates/${draft.industryTemplateId}`, {
          version: draft.version,
          reason: "drop booking",
          allowedModuleKeys: draft.allowedModuleKeys.filter((key) => key !== "booking"),
        }),
      ]);
      const stored = await templateRow(draftKey);
      const modules = stored?.["allowedModuleKeys"] as readonly string[];
      const landed = (await organizationKey(organizationId)) === draftKey;
      const bookingKept = modules.includes("booking");

      expect(landed && !bookingKept).toBe(false);
      if (landed) {
        expect(patched.status).toBe(422);
        expect(patched.body.error.details.removed).toContain("module:booking");
      }
      if (!bookingKept) {
        expect(moved.status).toBe(422);
        expect(moved.body.error.details.removed).toContain("module:booking");
      }
    }
  });
});
