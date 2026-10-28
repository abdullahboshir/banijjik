import { ERROR_CODE } from "@banijjik/contracts";
import {
  SECTION_KEY,
  type PublishedSiteDesign,
  type SiteDesign,
} from "@banijjik/contracts/website";
import { asId, newId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import {
  InMemorySiteRepository,
  permissivePolicy,
  seedSite,
  siteDesign,
  siteHero,
  siteOfferingGrid,
} from "../../../../../test-support/site-fixtures.js";
import {
  FakeSiteSectionAvailability,
  InMemorySiteVersionRepository,
  publicationFakes,
  storedVersion,
  type PublicationFakes,
} from "../../../../../test-support/site-publication-fakes.js";
import { projectPublishedDesign } from "../../domain/site-projection.js";
import { PublishSiteUseCase, UnpublishSiteUseCase } from "./publish-site.use-case.js";
import {
  GetPublishedSiteUseCase,
  GetSiteDraftUseCase,
  ListSiteVersionsUseCase,
} from "./read-site.use-case.js";

const ALL_KEYS = Object.values(SECTION_KEY);
const ACTOR = asId<UserId>(newId());
/** The projection a snapshot row holds, built the same way the publish command builds it. */
function snapshotOf(design: SiteDesign): PublishedSiteDesign {
  return projectPublishedDesign({ design, effectiveSectionKeys: ALL_KEYS });
}

describe("GetSiteDraftUseCase", () => {
  it("returns the draft, the stored policy and the publication pointer", async () => {
    const fakes = publicationFakes({ sections: new FakeSiteSectionAvailability(ALL_KEYS) });
    const site = seedSite(fakes.sites);

    const draft = await new GetSiteDraftUseCase(fakes.sites).execute();

    expect(draft).toEqual({
      siteId: site.siteId,
      version: 1,
      publishedWebsiteVersionId: null,
      design: siteDesign(),
      policy: permissivePolicy(),
    });
  });

  it("follows the pointer after a publish while the draft stays the draft", async () => {
    const fakes = publicationFakes({ sections: new FakeSiteSectionAvailability(ALL_KEYS) });
    const site = seedSite(fakes.sites);
    const published = await new PublishSiteUseCase(fakes).execute({
      actorUserId: ACTOR,
      body: { expectedVersion: site.version },
    });

    const draft = await new GetSiteDraftUseCase(fakes.sites).execute();

    expect(draft.version).toBe(2);
    expect(draft.publishedWebsiteVersionId).toBe(published.websiteVersionId);
    expect(draft.design).toEqual(siteDesign());
    expect(draft).not.toHaveProperty("nextRevision");
    expect(draft).not.toHaveProperty("hasPublishedOnce");
    expect(draft).not.toHaveProperty("sourceTemplateKey");
  });

  it("answers NOT_FOUND when the organization has no site yet", async () => {
    const sites = new InMemorySiteRepository();

    await expect(new GetSiteDraftUseCase(sites).execute()).rejects.toMatchObject({
      code: ERROR_CODE.NOT_FOUND,
    });
  });
});

describe("ListSiteVersionsUseCase", () => {
  /** Several snapshots of one site, oldest first, so paging has something to walk through. */
  function siteWithRevisions(count: number): PublicationFakes {
    const fakes = publicationFakes({ versions: new InMemorySiteVersionRepository() });
    const site = seedSite(fakes.sites);
    for (let revision = 1; revision <= count; revision += 1) {
      fakes.versions.rows.push(storedVersion({ site, design: snapshotOf(siteDesign()), revision }));
    }
    return fakes;
  }

  it("lists one page newest first with the window the caller asked for", async () => {
    const fakes = siteWithRevisions(3);

    const listed = await new ListSiteVersionsUseCase(fakes).execute({ page: 1, limit: 2 });

    expect(listed.items.map((item) => item.revision)).toEqual([3, 2]);
    expect(listed).toMatchObject({ page: 1, limit: 2, total: 3 });
  });

  it("gives the next page without repeating a revision", async () => {
    const fakes = siteWithRevisions(3);

    const listed = await new ListSiteVersionsUseCase(fakes).execute({ page: 2, limit: 2 });

    expect(listed.items.map((item) => item.revision)).toEqual([1]);
    expect(listed.total).toBe(3);
  });

  it("returns metadata only, never a snapshot body (P4-18)", async () => {
    const fakes = siteWithRevisions(1);

    const listed = await new ListSiteVersionsUseCase(fakes).execute({ page: 1, limit: 20 });

    expect(Object.keys(listed.items[0] ?? {}).sort()).toEqual([
      "publishedAt",
      "publishedByUserId",
      "revision",
      "schemaVersion",
      "sourceTemplateKey",
      "sourceTemplateRevision",
      "websiteVersionId",
    ]);
    expect(listed.items[0]?.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("keeps another site's revisions out of the list", async () => {
    const fakes = siteWithRevisions(2);
    const otherSite = seedSite(new InMemorySiteRepository());
    fakes.versions.rows.push(
      storedVersion({ site: otherSite, design: snapshotOf(siteDesign()), revision: 9 }),
    );

    const listed = await new ListSiteVersionsUseCase(fakes).execute({ page: 1, limit: 20 });

    expect(listed.items.map((item) => item.revision)).toEqual([2, 1]);
    expect(listed.total).toBe(2);
  });

  it("answers NOT_FOUND when the organization has no site yet", async () => {
    const fakes = publicationFakes({ sites: new InMemorySiteRepository() });

    await expect(
      new ListSiteVersionsUseCase(fakes).execute({ page: 1, limit: 20 }),
    ).rejects.toMatchObject({ code: ERROR_CODE.NOT_FOUND });
  });
});

describe("GetPublishedSiteUseCase", () => {
  /** A site whose public pointer names revision one of the given draft. */
  async function publishedFakes(design = siteDesign()): Promise<PublicationFakes> {
    const fakes = publicationFakes({ sections: new FakeSiteSectionAvailability(ALL_KEYS) });
    const site = seedSite(fakes.sites, design);
    await new PublishSiteUseCase(fakes).execute({
      actorUserId: ACTOR,
      body: { expectedVersion: site.version },
    });
    return fakes;
  }

  it("serves the snapshot the public pointer names", async () => {
    const fakes = await publishedFakes();
    const siteId = fakes.sites.site?.siteId;
    if (siteId === undefined) throw new Error("fixture site missing");

    const served = await new GetPublishedSiteUseCase(fakes).execute();

    expect(served).toEqual({
      siteId,
      websiteVersionId: fakes.sites.site?.publishedWebsiteVersionId,
      revision: 1,
      design: snapshotOf(siteDesign()),
      publishedAt: fakes.clock.now().toISOString(),
    });
  });

  it("drops a section whose module was switched off after publishing (P4-12)", async () => {
    const fakes = await publishedFakes(siteDesign({ sections: [siteHero(), siteOfferingGrid()] }));
    const commerceOff = new FakeSiteSectionAvailability([
      SECTION_KEY.header,
      SECTION_KEY.footer,
      SECTION_KEY.hero,
    ]);
    const dependencies = { ...fakes, sections: commerceOff };

    const served = await new GetPublishedSiteUseCase(dependencies).execute();

    expect(served.design.pages[0]?.sections).toEqual([siteHero()]);
    expect(served.design.header).toEqual(siteDesign().header);
    expect(served.design.footer).toEqual(siteDesign().footer);
  });

  it("refuses with its own 404 while nothing is published", async () => {
    const fakes = publicationFakes({ sections: new FakeSiteSectionAvailability(ALL_KEYS) });
    seedSite(fakes.sites);

    await expect(new GetPublishedSiteUseCase(fakes).execute()).rejects.toMatchObject({
      code: ERROR_CODE.NOT_FOUND,
      messageKey: "errors.website_not_published",
    });
  });

  it("refuses the same 404 when the organization has no site at all", async () => {
    const fakes = publicationFakes({ sites: new InMemorySiteRepository() });

    await expect(new GetPublishedSiteUseCase(fakes).execute()).rejects.toMatchObject({
      code: ERROR_CODE.NOT_FOUND,
      messageKey: "errors.website_not_published",
    });
  });

  it("refuses the same 404 when the pointer names a missing snapshot", async () => {
    const fakes = await publishedFakes();
    fakes.versions.rows.length = 0;

    await expect(new GetPublishedSiteUseCase(fakes).execute()).rejects.toMatchObject({
      code: ERROR_CODE.NOT_FOUND,
      messageKey: "errors.website_not_published",
    });
  });

  it("refuses the same 404 after an unpublish while the history row stays", async () => {
    const fakes = await publishedFakes();
    const websiteVersionId = fakes.sites.site?.publishedWebsiteVersionId;

    await new UnpublishSiteUseCase(fakes).execute({
      actorUserId: ACTOR,
      body: { expectedVersion: 2 },
    });

    await expect(new GetPublishedSiteUseCase(fakes).execute()).rejects.toMatchObject({
      code: ERROR_CODE.NOT_FOUND,
    });
    expect(fakes.versions.rows.map((row) => row.websiteVersionId)).toEqual([websiteVersionId]);
  });
});
