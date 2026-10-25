import {
  SITE_PAGE_BODY_MAX_LENGTH,
  SITE_PAGE_TITLE_MAX_LENGTH,
  type SitePageResponse,
  type SitePageUpsertRequest,
} from "@banijjik/contracts/website";

export interface BilingualDraft {
  readonly bn: string;
  readonly en: string;
}

/** What the editor holds: the text per language and the publish switch. */
export interface SitePageDraft {
  readonly title: BilingualDraft;
  readonly body: BilingualDraft;
  readonly isPublished: boolean;
}

export const PAGE_ERROR_KEY = Object.freeze({
  titleRequired: "website.pages.error.titleRequired",
  titleTooLong: "website.pages.error.titleTooLong",
  bodyTooLong: "website.pages.error.bodyTooLong",
});

export function draftOf(page: SitePageResponse): SitePageDraft {
  return { title: page.title, body: page.body, isPublished: page.isPublished };
}

/**
 * The checks the API also makes (M.6a decision 1). The page shows them first so that a save is not
 * refused for a reason the editor could have shown; the API stays the authority.
 */
export function draftProblemKeys(draft: SitePageDraft): readonly string[] {
  const problems: string[] = [];
  const hasTitle = draft.title.bn.trim() !== "" || draft.title.en.trim() !== "";
  if (draft.isPublished && !hasTitle) problems.push(PAGE_ERROR_KEY.titleRequired);
  const longTitle =
    draft.title.bn.trim().length > SITE_PAGE_TITLE_MAX_LENGTH ||
    draft.title.en.trim().length > SITE_PAGE_TITLE_MAX_LENGTH;
  if (longTitle) problems.push(PAGE_ERROR_KEY.titleTooLong);
  const longBody =
    draft.body.bn.length > SITE_PAGE_BODY_MAX_LENGTH ||
    draft.body.en.length > SITE_PAGE_BODY_MAX_LENGTH;
  if (longBody) problems.push(PAGE_ERROR_KEY.bodyTooLong);
  return problems;
}

/** The save body: the stored version, so a stale editor gets a 409 instead of overwriting. */
export function upsertBodyOf(draft: SitePageDraft, version: number): SitePageUpsertRequest {
  return {
    title: { bn: draft.title.bn.trim(), en: draft.title.en.trim() },
    body: draft.body,
    isPublished: draft.isPublished,
    version,
  };
}
