import {
  CUSTOM_FIELD_SCOPE,
  CUSTOM_FIELD_TYPE,
  PERMISSION_KEY,
  type EffectiveCustomField,
} from "@banijjik/contracts";
import { LISTING_FIELD_TIER, type ListingFieldTier } from "@banijjik/contracts/directory";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchResource = vi.fn();
const requireAccess = vi.fn();
vi.mock("../lib/api/server-resource", () => ({
  fetchBusinessResource: (...args: unknown[]) => fetchResource(...args),
}));
vi.mock("../shell/org-access", () => ({
  requireOrgAccess: (...args: unknown[]) => requireAccess(...args),
}));
vi.mock("../lib/i18n/get-translator", () => ({
  getTranslator: async () => ({ locale: "en", t: (key: string) => key }),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { DirectoryQueuePage } = await import("./queue-page");

function field(
  fieldKey: string,
  tier?: ListingFieldTier,
  sectionKey = "basics",
): EffectiveCustomField {
  return {
    fieldKey,
    sectionKey,
    scope: CUSTOM_FIELD_SCOPE.ORGANIZATION,
    isEditable: true,
    entityType: "listing",
    label: { bn: fieldKey, en: fieldKey },
    fieldType: CUSTOM_FIELD_TYPE.TEXT,
    isRequired: false,
    visibility: { admin: true, storefront: true, bot: false },
    botAsk: false,
    isSearchable: false,
    isSensitive: false,
    sortOrder: 1,
    version: 1,
    status: "ACTIVE",
    ...(tier === undefined ? {} : { listingTier: tier }),
  };
}

function seed(total: number, allowed = true): void {
  requireAccess.mockResolvedValue({
    organization: { organizationId: "organization-a" },
    config: {
      permissions: {
        allLocations: allowed ? [PERMISSION_KEY.DIRECTORY_LISTING_READ] : [],
        byLocation: {},
      },
      terms: {},
      fields: {
        listing: [
          field("public", LISTING_FIELD_TIER.PUBLIC),
          field("legacy"),
          field("private", LISTING_FIELD_TIER.PRIVATE),
          field("member", LISTING_FIELD_TIER.MEMBERS),
          field("connected", LISTING_FIELD_TIER.UNLOCKED),
          field("other", LISTING_FIELD_TIER.PUBLIC, "other"),
        ],
      },
    },
  });
  fetchResource.mockImplementation(async (path: string) => {
    if (path.endsWith("/config")) {
      return { data: { sections: [{ sectionKey: "basics", label: { bn: "মূল", en: "Basics" } }] } };
    }
    const listing = {
      listingId: "listing-a",
      listingNumber: "BD-1",
      status: "SUBMITTED",
      reviewedAt: null,
      submittedAt: null,
      customFields: {
        public: "public-value",
        legacy: "legacy-value",
        private: "private-value",
        member: "member-value",
        connected: "connected-value",
        other: "other-value",
      },
    };
    return { data: { total, items: total === 0 ? [] : [listing] } };
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("moderation queue page", () => {
  it("requests a bounded second page and offers previous and next links", async () => {
    seed(101);
    const html = renderToStaticMarkup(
      await DirectoryQueuePage({ orgSlug: "acme", searchParams: { page: "2" } }),
    );
    expect(fetchResource).toHaveBeenCalledWith(
      "/orgs/organization-a/directory/queue?status=SUBMITTED&page=2&limit=50",
    );
    expect(html).toContain('href="/acme/directory/queue"');
    expect(html).toContain('href="/acme/directory/queue?page=3"');
  });

  it("previews only public fields from the first section, including legacy public defaults", async () => {
    seed(1);
    const html = renderToStaticMarkup(
      await DirectoryQueuePage({ orgSlug: "acme", searchParams: {} }),
    );
    expect(html).toContain("public-value");
    expect(html).toContain("legacy-value");
    for (const hidden of ["private-value", "member-value", "connected-value", "other-value"])
      expect(html).not.toContain(hidden);
    expect(html).not.toContain("directory.page.next");
    expect(html).not.toContain("directory.page.previous");
  });

  it.each(["0", "-1", "invalid", "Infinity"])("falls back to page one for %s", async (page) => {
    seed(0);
    const html = renderToStaticMarkup(
      await DirectoryQueuePage({ orgSlug: "acme", searchParams: { page } }),
    );
    expect(fetchResource).toHaveBeenCalledWith(
      "/orgs/organization-a/directory/queue?status=SUBMITTED&page=1&limit=50",
    );
    expect(html).toContain("directory.queue.empty");
  });

  it("offers a way back from an empty later page", async () => {
    seed(0);
    const html = renderToStaticMarkup(
      await DirectoryQueuePage({ orgSlug: "acme", searchParams: { page: "3" } }),
    );
    expect(html).toContain('href="/acme/directory/queue?page=2"');
    expect(html).not.toContain("directory.page.next");
  });

  it("does not fetch tenant data without read permission", async () => {
    seed(1, false);
    const html = renderToStaticMarkup(
      await DirectoryQueuePage({ orgSlug: "acme", searchParams: {} }),
    );
    expect(html).toContain("errors.forbidden");
    expect(fetchResource).not.toHaveBeenCalled();
  });
});
