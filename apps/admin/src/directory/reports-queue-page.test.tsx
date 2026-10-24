import { PERMISSION_KEY } from "@banijjik/contracts";
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

const { ReportsQueuePage } = await import("./reports-queue-page");

function seed(total: number, allowed = true): void {
  requireAccess.mockResolvedValue({
    organization: { organizationId: "organization-a" },
    config: {
      permissions: {
        allLocations: allowed ? [PERMISSION_KEY.DIRECTORY_REPORT_READ] : [],
        byLocation: {},
      },
      terms: {},
    },
  });
  fetchResource.mockImplementation(async (path: string) => {
    if (path.endsWith("/config")) {
      return {
        data: {
          reportReasons: [{ reasonKey: "fake", label: { bn: "ভুয়া", en: "Fake profile" } }],
        },
      };
    }
    const item = {
      listingId: "listing-a",
      listingNumber: "BD-7",
      listingStatus: "APPROVED",
      openCount: 3,
      reasonKeys: ["fake", "retired"],
      oldestReportAt: "2026-10-20T04:00:00.000Z",
      newestReportAt: "2026-10-21T04:00:00.000Z",
    };
    return { data: { total, items: total === 0 ? [] : [item] } };
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("report queue page", () => {
  it("lists the grouped queue with template reason labels and a link to the detail", async () => {
    seed(1);
    const html = renderToStaticMarkup(
      await ReportsQueuePage({ orgSlug: "acme", searchParams: {} }),
    );
    expect(fetchResource).toHaveBeenCalledWith(
      "/orgs/organization-a/directory/reports?status=OPEN&page=1&limit=50",
    );
    expect(html).toContain("BD-7");
    expect(html).toContain("Fake profile");
    expect(html).toContain("retired");
    expect(html).toContain('href="/acme/directory/reports/listing-a"');
    expect(html).toContain("directory.reports.age.days");
  });

  it("shows the empty state when no listing has open reports", async () => {
    seed(0);
    const html = renderToStaticMarkup(
      await ReportsQueuePage({ orgSlug: "acme", searchParams: {} }),
    );
    expect(html).toContain("directory.reports.empty");
  });

  it("requests a bounded later page and offers previous and next links", async () => {
    seed(101);
    const html = renderToStaticMarkup(
      await ReportsQueuePage({ orgSlug: "acme", searchParams: { page: "2" } }),
    );
    expect(fetchResource).toHaveBeenCalledWith(
      "/orgs/organization-a/directory/reports?status=OPEN&page=2&limit=50",
    );
    expect(html).toContain('href="/acme/directory/reports"');
    expect(html).toContain('href="/acme/directory/reports?page=3"');
  });

  it("does not fetch tenant data without the report read permission", async () => {
    seed(1, false);
    const html = renderToStaticMarkup(
      await ReportsQueuePage({ orgSlug: "acme", searchParams: {} }),
    );
    expect(html).toContain("errors.forbidden");
    expect(fetchResource).not.toHaveBeenCalled();
  });
});
