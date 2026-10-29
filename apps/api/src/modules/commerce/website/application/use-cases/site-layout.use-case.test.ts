import { ERROR_CODE, type LocalizedText } from "@banijjik/contracts";
import {
  CONSERVATIVE_PAGE_RULES,
  LOCKED_TOKEN_GROUPS,
  SECTION_KEY,
  type SiteEditPolicy,
  type SitePageRules,
  type SiteTokens,
} from "@banijjik/contracts/website";
import { asId, isUuidV7, newId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import {
  InMemorySiteRepository,
  SITE_ID,
  newSitePage,
  permissivePolicy,
  seedSite,
  siteDesign,
  siteTokens,
} from "../../../../../test-support/site-fixtures.js";
import { FakeSiteSectionAvailability } from "../../../../../test-support/site-publication-fakes.js";
import { MutableClock } from "../../../../../test-support/mutable-clock.js";
import type { SiteLayoutDependencies } from "./site-layout.use-case.js";
import {
  CreateSiteLayoutPageUseCase,
  ListSiteLayoutPagesUseCase,
  UpdateSiteLayoutPageUseCase,
  UpdateSiteThemeUseCase,
} from "./site-layout.use-case.js";

const ACTOR = asId<UserId>(newId());
const ALL_SECTIONS = Object.values(SECTION_KEY);
const RENAMED_TITLE = { bn: "", en: "Renamed" };

function withPageRules(rules: SitePageRules): SiteEditPolicy {
  return { ...permissivePolicy(), pageRules: rules };
}

function withLockedTokens(): SiteEditPolicy {
  return { ...permissivePolicy(), tokenGroups: LOCKED_TOKEN_GROUPS };
}

/** A seeded site plus the dependencies its part endpoints run on. */
function layout(policy: SiteEditPolicy = permissivePolicy(), effective = ALL_SECTIONS) {
  const sites = new InMemorySiteRepository();
  const site = seedSite(sites, siteDesign(), policy);
  const dependencies: SiteLayoutDependencies = {
    sites,
    sections: new FakeSiteSectionAvailability(effective),
    clock: new MutableClock(),
  };
  return { site, sites, dependencies };
}

function largerType(): SiteTokens {
  return { ...siteTokens(), type: { fontPairKey: "inter-noto", scale: "LARGE" } };
}

describe("ListSiteLayoutPagesUseCase", () => {
  it("answers the pages of the draft with the version they were read at", async () => {
    const { site, dependencies } = layout();

    const listed = await new ListSiteLayoutPagesUseCase(dependencies).execute();

    expect(listed).toEqual({
      siteId: site.siteId,
      version: 1,
      pages: site.draftDesign.pages,
    });
  });

  it("answers NOT_FOUND for a business with no site", async () => {
    const sites = new InMemorySiteRepository();

    await expect(new ListSiteLayoutPagesUseCase({ sites }).execute()).rejects.toMatchObject({
      code: ERROR_CODE.NOT_FOUND,
    });
  });
});

describe("UpdateSiteThemeUseCase", () => {
  it("replaces the token block and sends every other part back unchanged", async () => {
    const { site, sites, dependencies } = layout();

    const saved = await new UpdateSiteThemeUseCase(dependencies).execute({
      actorUserId: ACTOR,
      body: { expectedVersion: 1, tokens: largerType() },
    });

    expect(saved.version).toBe(2);
    expect(saved.design.tokens.type.scale).toBe("LARGE");
    expect(saved.design.header).toEqual(site.draftDesign.header);
    expect(saved.design.pages).toEqual(site.draftDesign.pages);
    expect(sites.site?.version).toBe(2);
  });

  it("refuses a locked token group and stores nothing", async () => {
    const { sites, dependencies } = layout(withLockedTokens());

    await expect(
      new UpdateSiteThemeUseCase(dependencies).execute({
        actorUserId: ACTOR,
        body: { expectedVersion: 1, tokens: largerType() },
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODE.WEBSITE_POLICY_DENIED,
      details: { reason: "locked_token_group:type" },
    });
    expect(sites.site?.version).toBe(1);
  });

  it("refuses a stale version before merging", async () => {
    const { sites, dependencies } = layout();

    await expect(
      new UpdateSiteThemeUseCase(dependencies).execute({
        actorUserId: ACTOR,
        body: { expectedVersion: 4, tokens: largerType() },
      }),
    ).rejects.toMatchObject({ code: ERROR_CODE.CONFLICT });
    expect(sites.site?.version).toBe(1);
  });
});

describe("CreateSiteLayoutPageUseCase", () => {
  const creatable = withPageRules({ ...CONSERVATIVE_PAGE_RULES, allowCreate: true });

  it("mints the new page id itself, so the document holds no client-supplied id", async () => {
    const { dependencies } = layout(creatable);

    const saved = await new CreateSiteLayoutPageUseCase(dependencies).execute({
      actorUserId: ACTOR,
      body: { expectedVersion: 1, page: newSitePage("/about-us", SITE_ID.secondHero) },
    });

    const added = saved.design.pages[1];
    expect(saved.design.pages).toHaveLength(2);
    expect(added?.pageId).not.toBe(SITE_ID.page);
    expect(isUuidV7(String(added?.pageId))).toBe(true);
    expect(added?.sections[0]?.sectionId).toBe(SITE_ID.secondHero);
  });

  it("refuses a page the policy does not allow to be created", async () => {
    const { sites, dependencies } = layout();

    await expect(
      new CreateSiteLayoutPageUseCase(dependencies).execute({
        actorUserId: ACTOR,
        body: { expectedVersion: 1, page: newSitePage("/about-us", SITE_ID.secondHero) },
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODE.WEBSITE_POLICY_DENIED,
      details: { reason: "page_create_denied" },
    });
    expect(sites.site?.draftDesign.pages).toHaveLength(1);
  });

  it("refuses a section whose module the business does not hold", async () => {
    const { dependencies } = layout(creatable, ["header", "footer", "rich-text"]);

    await expect(
      new CreateSiteLayoutPageUseCase(dependencies).execute({
        actorUserId: ACTOR,
        body: { expectedVersion: 1, page: newSitePage("/about-us", SITE_ID.secondHero) },
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODE.WEBSITE_POLICY_DENIED,
      details: { reason: "section_not_available" },
    });
  });
});

describe("UpdateSiteLayoutPageUseCase", () => {
  function pageRenamed(title: LocalizedText, path = "/home") {
    return { ...newSitePage(path, SITE_ID.hero), title };
  }

  it("replaces the page the path names and keeps its id", async () => {
    const { dependencies } = layout();

    const saved = await new UpdateSiteLayoutPageUseCase(dependencies).execute({
      actorUserId: ACTOR,
      pageId: SITE_ID.page,
      body: { expectedVersion: 1, page: pageRenamed(RENAMED_TITLE) },
    });

    expect(saved.design.pages).toHaveLength(1);
    expect(saved.design.pages[0]?.pageId).toBe(SITE_ID.page);
    expect(saved.design.pages[0]?.title).toEqual(RENAMED_TITLE);
    expect(saved.version).toBe(2);
  });

  it("answers NOT_FOUND for a page the draft does not hold", async () => {
    const { sites, dependencies } = layout();

    await expect(
      new UpdateSiteLayoutPageUseCase(dependencies).execute({
        actorUserId: ACTOR,
        pageId: newId(),
        body: { expectedVersion: 1, page: pageRenamed(RENAMED_TITLE) },
      }),
    ).rejects.toMatchObject({ code: ERROR_CODE.NOT_FOUND });
    expect(sites.site?.version).toBe(1);
  });

  it("refuses a path change the policy locks, not a new page", async () => {
    const { sites, dependencies } = layout();

    await expect(
      new UpdateSiteLayoutPageUseCase(dependencies).execute({
        actorUserId: ACTOR,
        pageId: SITE_ID.page,
        body: { expectedVersion: 1, page: pageRenamed(RENAMED_TITLE, "/renamed") },
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODE.WEBSITE_POLICY_DENIED,
      details: { reason: "path_change_denied" },
    });
    expect(sites.site?.draftDesign.pages[0]?.path).toBe("/home");
  });

  it("refuses a stale version before touching the page", async () => {
    const { dependencies } = layout();

    await expect(
      new UpdateSiteLayoutPageUseCase(dependencies).execute({
        actorUserId: ACTOR,
        pageId: SITE_ID.page,
        body: { expectedVersion: 3, page: pageRenamed(RENAMED_TITLE) },
      }),
    ).rejects.toMatchObject({ code: ERROR_CODE.CONFLICT });
  });
});
