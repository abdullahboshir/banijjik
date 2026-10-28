import { AUDIT_ACTION, ERROR_CODE } from "@banijjik/contracts";
import { SECTION_KEY, WEBSITE_EVENT_TYPE } from "@banijjik/contracts/website";
import { asId, newId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import {
  InMemorySiteRepository,
  permissivePolicy,
  seedSite,
  SITE_TEST_TEXT,
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
} from "../../../../../test-support/site-publication-fakes.js";
import { PublishSiteUseCase, UnpublishSiteUseCase } from "./publish-site.use-case.js";

const ALL_KEYS = Object.values(SECTION_KEY);
const FILE_ID = "01926b48-1234-7abc-8def-0123456789c1";
const ACTOR = asId<UserId>(newId());

describe("PublishSiteUseCase", () => {
  it("stores one snapshot, moves the pointer and consumes one revision", async () => {
    const fakes = publicationFakes({ sections: new FakeSiteSectionAvailability(ALL_KEYS) });
    const site = seedSite(fakes.sites);

    const published = await new PublishSiteUseCase(fakes).execute({
      actorUserId: ACTOR,
      body: { expectedVersion: site.version },
    });

    expect(published.revision).toBe(1);
    expect(published.siteId).toBe(site.siteId);
    expect(published.publishedAt).toBe(fakes.clock.now().toISOString());
    expect(fakes.versions.rows.length).toBe(1);
    expect(fakes.sites.site?.publishedWebsiteVersionId).toBe(published.websiteVersionId);
    expect(fakes.sites.site?.nextRevision).toBe(2);
    expect(fakes.sites.site?.hasPublishedOnce).toBe(true);
    expect(fakes.sites.site?.version).toBe(2);
  });

  it("records the audit row and the outbox event of the same publication", async () => {
    const fakes = publicationFakes({ sections: new FakeSiteSectionAvailability(ALL_KEYS) });
    const site = seedSite(fakes.sites);

    const published = await new PublishSiteUseCase(fakes).execute({
      actorUserId: ACTOR,
      body: { expectedVersion: site.version },
    });

    expect(fakes.audit.entries[0]).toMatchObject({
      action: AUDIT_ACTION.SITE_PUBLISHED,
      entityType: "site",
      entityId: site.siteId,
    });
    expect(fakes.events.published).toEqual([
      {
        type: WEBSITE_EVENT_TYPE.SITE_PUBLISHED,
        payload: {
          siteId: site.siteId,
          websiteVersionId: published.websiteVersionId,
          revision: 1,
        },
        orderingKey: `website:${site.organizationId}`,
      },
    ]);
  });

  it("publishes the projection, so a draft-only flag never reaches storage", async () => {
    const fakes = publicationFakes({ sections: new FakeSiteSectionAvailability(ALL_KEYS) });
    const site = seedSite(
      fakes.sites,
      siteDesign({ staticContent: [siteStaticPage("ABOUT", false), siteStaticPage("FAQ", true)] }),
    );

    await new PublishSiteUseCase(fakes).execute({
      actorUserId: ACTOR,
      body: { expectedVersion: site.version },
    });

    expect(fakes.versions.rows[0]?.design.staticContent).toEqual([
      { pageKey: "FAQ", title: SITE_TEST_TEXT, body: SITE_TEST_TEXT },
    ]);
  });

  it("drops a section whose module stopped being effective", async () => {
    const fakes = publicationFakes({
      sections: new FakeSiteSectionAvailability([
        SECTION_KEY.header,
        SECTION_KEY.footer,
        SECTION_KEY.hero,
      ]),
    });
    const site = seedSite(fakes.sites, siteDesign({ sections: [siteHero(), siteOfferingGrid()] }));

    const published = await new PublishSiteUseCase(fakes).execute({
      actorUserId: ACTOR,
      body: { expectedVersion: site.version },
    });

    expect(published.design.pages[0]?.sections.map((section) => section.sectionKey)).toEqual([
      SECTION_KEY.hero,
    ]);
  });

  it("applies a policy tightened after the last save", async () => {
    const fakes = publicationFakes({ sections: new FakeSiteSectionAvailability(ALL_KEYS) });
    seedSite(fakes.sites, siteDesign(), { ...permissivePolicy(), allowedColors: ["#000000"] });

    await expect(
      new PublishSiteUseCase(fakes).execute({ actorUserId: ACTOR, body: { expectedVersion: 1 } }),
    ).rejects.toMatchObject({
      code: ERROR_CODE.WEBSITE_POLICY_DENIED,
      details: { reason: "color_not_allowed" },
    });
    expect(fakes.versions.rows.length).toBe(0);
    expect(fakes.events.published.length).toBe(0);
  });

  it("refuses an image the organization may not show publicly", async () => {
    const images = new FakeSiteMediaChecker([]);
    const fakes = publicationFakes({
      sections: new FakeSiteSectionAvailability(ALL_KEYS),
      images,
    });
    const site = seedSite(fakes.sites, siteDesign({ sections: [siteHero(FILE_ID)] }));

    await expect(
      new PublishSiteUseCase(fakes).execute({
        actorUserId: ACTOR,
        body: { expectedVersion: site.version },
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODE.WEBSITE_REFERENCE_INVALID,
      details: { reason: "unusable_image", fileIds: [FILE_ID] },
    });
    expect(images.asked).toEqual([FILE_ID]);
    expect(fakes.versions.rows.length).toBe(0);
    expect(fakes.sites.site?.publishedWebsiteVersionId).toBeNull();
  });

  it("publishes the same image once it is usable", async () => {
    const images = new FakeSiteMediaChecker([FILE_ID]);
    const fakes = publicationFakes({
      sections: new FakeSiteSectionAvailability(ALL_KEYS),
      images,
    });
    const site = seedSite(fakes.sites, siteDesign({ sections: [siteHero(FILE_ID)] }));

    const published = await new PublishSiteUseCase(fakes).execute({
      actorUserId: ACTOR,
      body: { expectedVersion: site.version },
    });

    expect(published.revision).toBe(1);
    expect(fakes.versions.rows[0]?.design.pages[0]?.sections[0]?.content).toMatchObject({
      imageFileId: FILE_ID,
    });
  });

  it("refuses a stale version and writes nothing", async () => {
    const fakes = publicationFakes({ sections: new FakeSiteSectionAvailability(ALL_KEYS) });
    seedSite(fakes.sites);

    await expect(
      new PublishSiteUseCase(fakes).execute({ actorUserId: ACTOR, body: { expectedVersion: 9 } }),
    ).rejects.toMatchObject({ code: ERROR_CODE.CONFLICT });
    expect(fakes.versions.rows.length).toBe(0);
    expect(fakes.audit.entries.length).toBe(0);
    expect(fakes.events.published.length).toBe(0);
  });

  it("answers NOT_FOUND for an organization with no site", async () => {
    const fakes = publicationFakes();

    await expect(
      new PublishSiteUseCase(fakes).execute({ actorUserId: ACTOR, body: { expectedVersion: 1 } }),
    ).rejects.toMatchObject({ code: ERROR_CODE.NOT_FOUND });
  });

  it("gives a replayed publication the same revision only once", async () => {
    const versions = new InMemorySiteVersionRepository();
    const sites = new InMemorySiteRepository();
    const original = seedSite(sites);
    const fakes = publicationFakes({
      sites,
      versions,
      sections: new FakeSiteSectionAvailability(ALL_KEYS),
    });
    await new PublishSiteUseCase(fakes).execute({
      actorUserId: ACTOR,
      body: { expectedVersion: 1 },
    });

    // The same transaction replayed against the version the editor still holds: the revision is taken.
    sites.site = original;
    await expect(
      new PublishSiteUseCase(fakes).execute({ actorUserId: ACTOR, body: { expectedVersion: 1 } }),
    ).rejects.toMatchObject({ code: ERROR_CODE.CONFLICT });
    expect(versions.rows.length).toBe(1);
  });
});

describe("UnpublishSiteUseCase", () => {
  async function withPublishedSite() {
    const fakes = publicationFakes({ sections: new FakeSiteSectionAvailability(ALL_KEYS) });
    const site = seedSite(fakes.sites);
    const published = await new PublishSiteUseCase(fakes).execute({
      actorUserId: ACTOR,
      body: { expectedVersion: site.version },
    });
    return { fakes, published };
  }

  it("clears the pointer, keeps the history and says so in an event", async () => {
    const { fakes, published } = await withPublishedSite();
    const site = fakes.sites.site;
    if (site === undefined) throw new Error("fixture site missing");

    const draft = await new UnpublishSiteUseCase(fakes).execute({
      actorUserId: ACTOR,
      body: { expectedVersion: 2 },
    });

    expect(draft.publishedWebsiteVersionId).toBeNull();
    expect(draft.version).toBe(3);
    expect(fakes.versions.rows.length).toBe(1);
    expect(site.hasPublishedOnce).toBe(true);
    expect(fakes.sites.site?.nextRevision).toBe(2);
    expect(fakes.events.published[1]).toEqual({
      type: WEBSITE_EVENT_TYPE.SITE_UNPUBLISHED,
      payload: {
        siteId: site.siteId,
        websiteVersionId: published.websiteVersionId,
        revision: 1,
      },
      orderingKey: `website:${site.organizationId}`,
    });
    expect(fakes.audit.entries[1]).toMatchObject({
      action: AUDIT_ACTION.SITE_UNPUBLISHED,
      entityId: site.siteId,
    });
  });

  it("refuses to unpublish a site that was never published", async () => {
    const fakes = publicationFakes();
    const site = seedSite(fakes.sites);

    await expect(
      new UnpublishSiteUseCase(fakes).execute({
        actorUserId: ACTOR,
        body: { expectedVersion: site.version },
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODE.BUSINESS_RULE,
      details: { reason: "not_published" },
    });
    expect(fakes.events.published.length).toBe(0);
  });

  it("refuses a stale version and keeps the site public", async () => {
    const { fakes, published } = await withPublishedSite();

    await expect(
      new UnpublishSiteUseCase(fakes).execute({ actorUserId: ACTOR, body: { expectedVersion: 1 } }),
    ).rejects.toMatchObject({ code: ERROR_CODE.CONFLICT });
    expect(fakes.sites.site?.publishedWebsiteVersionId).toBe(published.websiteVersionId);
  });

  it("answers NOT_FOUND when the pointer names a snapshot that is gone", async () => {
    const { fakes, published } = await withPublishedSite();
    fakes.versions.rows.length = 0;

    await expect(
      new UnpublishSiteUseCase(fakes).execute({ actorUserId: ACTOR, body: { expectedVersion: 2 } }),
    ).rejects.toMatchObject({ code: ERROR_CODE.NOT_FOUND });
    expect(fakes.sites.site?.publishedWebsiteVersionId).toBe(published.websiteVersionId);
  });
});
