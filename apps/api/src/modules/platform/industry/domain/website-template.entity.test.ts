import { ERROR_CODE, PLATFORM_RULE_KEY } from "@banijjik/contracts";
import { WEBSITE_TEMPLATE_STATUS } from "@banijjik/contracts/website";
import { newId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { createWebsiteTemplateRevision, WebsiteTemplate } from "./website-template.entity.js";
import { websiteTemplateContent } from "../website-template.test-fixtures.js";

const ACTOR_USER_ID = newId<UserId>();
const NOW = new Date("2026-10-29T06:00:00.000Z");

function newTemplate() {
  return WebsiteTemplate.create({
    templateKey: "starter-chrome",
    content: websiteTemplateContent(),
    now: NOW,
  });
}

function revision(template: WebsiteTemplate, number: number, content = template.content) {
  return createWebsiteTemplateRevision({
    websiteTemplateId: template.websiteTemplateId,
    templateKey: template.templateKey,
    revision: number,
    snapshot: content,
    publishedAt: NOW,
    publishedByUserId: ACTOR_USER_ID,
  });
}

describe("WebsiteTemplate", () => {
  it("a new template is DRAFT at version 1 with no current revision", () => {
    const template = newTemplate();

    expect(template.status).toBe(WEBSITE_TEMPLATE_STATUS.DRAFT);
    expect(template.version).toBe(1);
    expect(template.currentWebsiteTemplateRevisionId).toBeNull();
  });

  it("publishing records the next revision and points at it without changing earlier snapshots", () => {
    const draft = newTemplate();
    const firstRevision = revision(draft, 1);
    const published = draft.published(firstRevision, NOW);
    const editedContent = websiteTemplateContent("#1d4ed8");
    const edited = published.withEdits(editedContent, new Date(NOW.getTime() + 1_000));
    const secondRevision = revision(edited, 2, editedContent);
    const republished = edited.published(secondRevision, new Date(NOW.getTime() + 2_000));

    expect(published.currentWebsiteTemplateRevisionId).toBe(
      firstRevision.websiteTemplateRevisionId,
    );
    expect(republished.currentWebsiteTemplateRevisionId).toBe(
      secondRevision.websiteTemplateRevisionId,
    );
    expect(firstRevision.revision).toBe(1);
    expect(firstRevision.snapshot).toEqual(draft.content);
    expect(firstRevision.snapshot).not.toEqual(edited.content);
    expect(republished.status).toBe(WEBSITE_TEMPLATE_STATUS.PUBLISHED);
  });

  it("archiving keeps every published revision reachable and blocks a further edit", () => {
    const publishedRevision = revision(newTemplate(), 1);
    const archived = newTemplate().published(publishedRevision, NOW).archived(NOW);

    expect(publishedRevision.snapshot.name.en).toBe("Title");
    expect(archived.currentWebsiteTemplateRevisionId).toBe(
      publishedRevision.websiteTemplateRevisionId,
    );
    expect(() => archived.withEdits(websiteTemplateContent(), NOW)).toThrow(
      expect.objectContaining({
        details: expect.objectContaining({ ruleKey: PLATFORM_RULE_KEY.WEBSITE_TEMPLATE_ARCHIVED }),
      }),
    );
  });

  it("an archived template cannot be published or edited", () => {
    const archived = newTemplate().archived(NOW);
    const nextRevision = revision(archived, 1);

    expect(() => archived.published(nextRevision, NOW)).toThrow(
      expect.objectContaining({
        details: expect.objectContaining({
          fromStatus: WEBSITE_TEMPLATE_STATUS.ARCHIVED,
          toStatus: WEBSITE_TEMPLATE_STATUS.PUBLISHED,
        }),
      }),
    );
    expect(() => archived.withEdits(websiteTemplateContent(), NOW)).toThrow(
      expect.objectContaining({
        details: expect.objectContaining({ ruleKey: PLATFORM_RULE_KEY.WEBSITE_TEMPLATE_ARCHIVED }),
      }),
    );
  });

  it("the domain rejects an invalid key, missing default preset, or image file reference", () => {
    const content = websiteTemplateContent();
    const missingDefault = { ...content, defaultPresetKey: "missing" };
    const design = structuredClone(content.design);
    const hero = design.pages[0]?.sections[0];
    if (hero === undefined) throw new Error("fixture hero section is missing");
    Reflect.set(hero.content, "imageFileId", "01926b48-1234-7abc-8def-0123456789a5");
    const withImage = { ...content, design };

    expect(() => WebsiteTemplate.create({ templateKey: "Upper Case", content, now: NOW })).toThrow(
      expect.objectContaining({ code: ERROR_CODE.VALIDATION_ERROR }),
    );
    expect(() => newTemplate().withEdits(missingDefault, NOW)).toThrow(
      expect.objectContaining({ code: ERROR_CODE.VALIDATION_ERROR }),
    );
    expect(() => newTemplate().withEdits(withImage, NOW)).toThrow(
      expect.objectContaining({
        details: expect.objectContaining({
          ruleKey: PLATFORM_RULE_KEY.WEBSITE_TEMPLATE_IMAGE_FORBIDDEN,
        }),
      }),
    );
  });
});
