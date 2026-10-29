import type { SitePageResponse } from "@banijjik/contracts/website";
import { describe, expect, it } from "vitest";
import {
  PAGE_ERROR_KEY,
  draftOf,
  draftProblemKeys,
  upsertBodyOf,
  type SitePageDraft,
} from "./site-page-draft";

const EMPTY_DRAFT: SitePageDraft = {
  title: { bn: "", en: "" },
  body: { bn: "", en: "" },
  isPublished: false,
};

describe("site page draft", () => {
  it("asks for a title before a page can be published", () => {
    expect(draftProblemKeys({ ...EMPTY_DRAFT, isPublished: true })).toEqual([
      PAGE_ERROR_KEY.titleRequired,
    ]);
    expect(
      draftProblemKeys({ ...EMPTY_DRAFT, title: { bn: "", en: "About" }, isPublished: true }),
    ).toEqual([]);
  });

  it("refuses a title over 120 characters and a body over 20,000", () => {
    const longTitle = "a".repeat(121);
    const longBody = "a".repeat(20_001);
    const problems = draftProblemKeys({
      ...EMPTY_DRAFT,
      title: { bn: "", en: longTitle },
      body: { bn: longBody, en: "" },
    });
    expect(problems).toEqual([PAGE_ERROR_KEY.titleTooLong, PAGE_ERROR_KEY.bodyTooLong]);
  });

  it("sends the stored version with the save, so a stale editor is refused", () => {
    const page: SitePageResponse = {
      pageKey: "ABOUT",
      title: { bn: " পরিচিতি ", en: "About" },
      body: { bn: "", en: "Hello" },
      isPublished: true,
      version: 4,
      updatedAt: null,
      publicationState: "LEGACY",
      siteVersion: null,
    };
    expect(upsertBodyOf(draftOf(page), page.version, page.siteVersion)).toEqual({
      title: { bn: "পরিচিতি", en: "About" },
      body: { bn: "", en: "Hello" },
      isPublished: true,
      version: 4,
    });
  });

  it("sends siteVersion when the page already belongs to a Site", () => {
    const page: SitePageResponse = {
      pageKey: "ABOUT",
      title: { bn: "", en: "About" },
      body: { bn: "", en: "Hello" },
      isPublished: false,
      version: 0,
      updatedAt: "2026-10-28T00:00:00.000Z",
      publicationState: "DRAFT",
      siteVersion: 3,
    };
    expect(upsertBodyOf(draftOf(page), page.version, page.siteVersion)).toEqual({
      title: { bn: "", en: "About" },
      body: { bn: "", en: "Hello" },
      isPublished: false,
      version: 0,
      siteVersion: 3,
    });
  });
});
