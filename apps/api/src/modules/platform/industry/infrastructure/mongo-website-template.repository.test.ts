import { ERROR_CODE } from "@banijjik/contracts";
import { newId, type UserId } from "@banijjik/ids";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  WebsiteTemplate,
  createWebsiteTemplateRevision,
} from "../domain/website-template.entity.js";
import { MongoWebsiteTemplateRepository } from "./mongo-website-template.repository.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import { websiteTemplateContent } from "../website-template.test-fixtures.js";

registerIamApiModels();

let harness: IamApiHarness;
let templateIndex = 0;
const repository = new MongoWebsiteTemplateRepository();
const actorUserId = newId<UserId>();
const now = new Date("2026-10-29T06:00:00.000Z");

beforeAll(async () => {
  harness = await startIamApi({ tenantRouters: [] });
});

afterAll(async () => {
  await harness.dispose();
});

function nextTemplate() {
  templateIndex += 1;
  return WebsiteTemplate.create({
    templateKey: `repo-template-${templateIndex}`,
    content: websiteTemplateContent(),
    now,
  });
}

function revision(template: WebsiteTemplate, number: number) {
  return createWebsiteTemplateRevision({
    websiteTemplateId: template.websiteTemplateId,
    templateKey: template.templateKey,
    revision: number,
    snapshot: template.content,
    publishedAt: new Date(now.getTime() + number * 1_000),
    publishedByUserId: actorUserId,
  });
}

describe("MongoWebsiteTemplateRepository", () => {
  it("a second insert of the same template key raises the key-taken conflict", async () => {
    const template = nextTemplate();
    await repository.insert(template, actorUserId);
    const duplicate = WebsiteTemplate.create({
      templateKey: template.templateKey,
      content: template.content,
      now,
    });

    await expect(repository.insert(duplicate, actorUserId)).rejects.toMatchObject({
      code: ERROR_CODE.CONFLICT,
      messageKey: "errors.website_template_key_taken",
    });
  });

  it("a stale expectedVersion raises the conflict with the current version", async () => {
    const template = nextTemplate();
    await repository.insert(template, actorUserId);
    const updated = template.withEdits(websiteTemplateContent("#1d4ed8"), now);
    const saved = await repository.update(updated, template.version, actorUserId);

    expect(saved.version).toBe(template.version + 1);
    await expect(repository.update(template, template.version, actorUserId)).rejects.toMatchObject({
      code: ERROR_CODE.CONFLICT,
      details: { currentVersion: saved.version },
    });
  });

  it("the revision list reads a bounded lean page with a stable order", async () => {
    const template = nextTemplate();
    await repository.insert(template, actorUserId);
    const firstRevision = revision(template, 1);
    const latestRevision = revision(template, 2);
    await repository.insertRevision(firstRevision);
    await repository.insertRevision(latestRevision);

    const firstPage = await repository.listRevisions({
      websiteTemplateId: template.websiteTemplateId,
      page: 1,
      limit: 1,
    });
    const secondPage = await repository.listRevisions({
      websiteTemplateId: template.websiteTemplateId,
      page: 2,
      limit: 1,
    });

    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.items[0]?.revision).toBe(2);
    expect(firstPage.items[0]?.websiteTemplateRevisionId).toBe(
      latestRevision.websiteTemplateRevisionId,
    );
    expect(firstPage.hasNext).toBe(true);
    expect(secondPage.items[0]?.revision).toBe(1);
    expect(secondPage.items[0]?.websiteTemplateRevisionId).toBe(
      firstRevision.websiteTemplateRevisionId,
    );
    expect(secondPage.hasNext).toBe(false);
    await expect(repository.findMaxRevision(template.websiteTemplateId)).resolves.toBe(2);
  });

  it("a duplicate revision pair from a replayed publish is stopped by the unique index", async () => {
    const template = nextTemplate();
    const firstRevision = revision(template, 1);
    await repository.insertRevision(firstRevision);

    await expect(repository.insertRevision(revision(template, 1))).rejects.toMatchObject({
      code: ERROR_CODE.CONFLICT,
    });
  });
});
