import { AUDIT_ACTION, ERROR_CODE } from "@banijjik/contracts";
import {
  SECTION_KEY,
  type PublishedSiteDesign,
  type SiteDesign,
} from "@banijjik/contracts/website";
import { asId, newId, type UserId, type WebsiteVersionId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import {
  seedSite,
  siteChrome,
  siteDesign,
  siteHero,
  siteOfferingGrid,
  siteStaticPage,
} from "../../../../../test-support/site-fixtures.js";
import {
  FakeSiteMediaChecker,
  FakeSiteSectionAvailability,
  InMemorySiteVersionRepository,
  publicationFakes,
  storedVersion,
} from "../../../../../test-support/site-publication-fakes.js";
import { projectPublishedDesign } from "../../domain/site-projection.js";
import { RestoreSiteUseCase } from "./restore-site.use-case.js";

const ALL_KEYS = Object.values(SECTION_KEY);
const ACTOR = asId<UserId>(newId());
const FILE_ID = "01926b48-1234-7abc-8def-0123456789c1";

/** The projection that was live back then: what the snapshot stores, without the draft-only flags. */
function publishedDesignOf(design: SiteDesign): PublishedSiteDesign {
  return projectPublishedDesign({ design, effectiveSectionKeys: ALL_KEYS });
}

interface RestoreCase {
  readonly fakes: ReturnType<typeof publicationFakes>;
  readonly versionId: WebsiteVersionId;
}

/** A stored snapshot next to the draft the tenant holds now, which is what restore compares. */
function restoreCase(input: {
  readonly current: SiteDesign;
  readonly snapshot: SiteDesign;
  readonly sections?: FakeSiteSectionAvailability;
  readonly images?: FakeSiteMediaChecker;
}): RestoreCase {
  const versions = new InMemorySiteVersionRepository();
  const fakes = publicationFakes({
    versions,
    sections: input.sections ?? new FakeSiteSectionAvailability(ALL_KEYS),
    ...(input.images === undefined ? {} : { images: input.images }),
  });
  const site = seedSite(fakes.sites, input.current);
  const version = storedVersion({ site, design: publishedDesignOf(input.snapshot), revision: 1 });
  versions.rows.push(version);
  return { fakes, versionId: version.websiteVersionId };
}

function restore(fakes: RestoreCase["fakes"], versionId: WebsiteVersionId, expectedVersion = 1) {
  return new RestoreSiteUseCase(fakes).execute({
    actorUserId: ACTOR,
    body: { expectedVersion, websiteVersionId: versionId },
  });
}

describe("RestoreSiteUseCase", () => {
  it("copies a snapshot into a new draft and keeps the stored policy", async () => {
    const snapshot = siteDesign({ sections: [{ ...siteHero(), variantKey: "CENTERED" }] });
    const testCase = restoreCase({ current: siteDesign(), snapshot });

    const restored = await restore(testCase.fakes, testCase.versionId);

    expect(restored.version).toBe(2);
    expect(restored.design).toEqual(snapshot);
    expect(restored.policy).toEqual(testCase.fakes.sites.site?.editPolicy);
    expect(testCase.fakes.versions.rows.length).toBe(1);
  });

  it("brings back the static pages of the snapshot as opted in", async () => {
    const testCase = restoreCase({
      current: siteDesign(),
      snapshot: siteDesign({ staticContent: [siteStaticPage("ABOUT", true)] }),
    });

    const restored = await restore(testCase.fakes, testCase.versionId);

    expect(restored.design.staticContent).toEqual([siteStaticPage("ABOUT", true)]);
  });

  it("keeps a draft page the snapshot never published", async () => {
    const testCase = restoreCase({
      current: siteDesign({ staticContent: [siteStaticPage("FAQ", false)] }),
      snapshot: siteDesign({ staticContent: [siteStaticPage("ABOUT", true)] }),
    });

    const restored = await restore(testCase.fakes, testCase.versionId);

    expect(restored.design.staticContent).toEqual([
      siteStaticPage("ABOUT", true),
      siteStaticPage("FAQ", false),
    ]);
  });

  it("refuses a snapshot whose section belongs to a module that is off now", async () => {
    const testCase = restoreCase({
      current: siteDesign({ sections: [siteHero()] }),
      snapshot: siteDesign({ sections: [siteHero(), siteOfferingGrid()] }),
      sections: new FakeSiteSectionAvailability([
        SECTION_KEY.header,
        SECTION_KEY.footer,
        SECTION_KEY.hero,
      ]),
    });

    await expect(restore(testCase.fakes, testCase.versionId)).rejects.toMatchObject({
      code: ERROR_CODE.WEBSITE_POLICY_DENIED,
      details: { reason: "section_not_available" },
    });
    expect(testCase.fakes.sites.site?.draftDesign.pages[0]?.sections.length).toBe(1);
  });

  it("refuses a snapshot that breaks a lock closed after it was published", async () => {
    const current = siteDesign();
    const testCase = restoreCase({
      current,
      snapshot: siteDesign({ header: siteChrome("header", "/moved") }),
    });

    await expect(restore(testCase.fakes, testCase.versionId)).rejects.toMatchObject({
      code: ERROR_CODE.WEBSITE_POLICY_DENIED,
      details: { reason: "locked_section" },
    });
    expect(testCase.fakes.sites.site?.draftDesign.header).toEqual(current.header);
  });

  it("refuses a snapshot that points at an image the business may not show", async () => {
    const images = new FakeSiteMediaChecker([]);
    const testCase = restoreCase({
      current: siteDesign(),
      snapshot: siteDesign({ sections: [siteHero(FILE_ID)] }),
      images,
    });

    await expect(restore(testCase.fakes, testCase.versionId)).rejects.toMatchObject({
      code: ERROR_CODE.WEBSITE_REFERENCE_INVALID,
      details: { reason: "unusable_image", fileIds: [FILE_ID] },
    });
    expect(images.asked).toEqual([FILE_ID]);
  });

  it("records the restore in the audit without publishing anything", async () => {
    const testCase = restoreCase({ current: siteDesign(), snapshot: siteDesign() });

    await restore(testCase.fakes, testCase.versionId);

    expect(testCase.fakes.audit.entries[0]).toMatchObject({
      action: AUDIT_ACTION.SITE_RESTORED,
      entityType: "site",
      changes: { revision: { to: 1 } },
    });
    expect(testCase.fakes.events.published.length).toBe(0);
    expect(testCase.fakes.sites.site?.publishedWebsiteVersionId).toBeNull();
  });

  it("refuses a stale version", async () => {
    const testCase = restoreCase({ current: siteDesign(), snapshot: siteDesign() });

    await expect(restore(testCase.fakes, testCase.versionId, 7)).rejects.toMatchObject({
      code: ERROR_CODE.CONFLICT,
    });
  });

  it("refuses a snapshot identifier the organization does not have", async () => {
    const testCase = restoreCase({ current: siteDesign(), snapshot: siteDesign() });
    const unknown = asId<WebsiteVersionId>(newId());

    await expect(restore(testCase.fakes, unknown)).rejects.toMatchObject({
      code: ERROR_CODE.NOT_FOUND,
    });
  });
});
