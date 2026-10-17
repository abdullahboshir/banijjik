// @vitest-environment jsdom
import { PERMISSION_KEY, type LocationResponse } from "@banijjik/contracts";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaText, banglaTranslator } from "../auth/test-helpers";
import { accessFixture, type AccessOptions } from "../settings/test-fixtures";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
const requireOrgAccess = vi.fn();
vi.mock("../shell/org-access", () => ({
  requireOrgAccess: (...args: unknown[]) => requireOrgAccess(...args),
}));
vi.mock("../lib/i18n/get-translator", () => ({
  getTranslator: () => Promise.resolve(banglaTranslator()),
}));
const fetchBusinessResource = vi.fn();
vi.mock("../lib/api/server-resource", () => ({
  fetchBusinessResource: (...args: unknown[]) => fetchBusinessResource(...args),
}));

const { LocationsPage } = await import("./locations-page");

/** A message that carries the {term} placeholder, as the page fills it: the catalog word unless a term is given. */
function withTerm(messageKey: string, term = banglaText("locations.term")): string {
  return banglaTranslator().t(messageKey, { term });
}

const ALL_WRITES = [
  PERMISSION_KEY.ORGANIZATION_LOCATION_READ,
  PERMISSION_KEY.ORGANIZATION_LOCATION_CREATE,
  PERMISSION_KEY.ORGANIZATION_LOCATION_UPDATE,
  PERMISSION_KEY.ORGANIZATION_LOCATION_ARCHIVE,
];

const LOCATIONS: LocationResponse[] = [
  {
    locationId: "l1",
    name: "মূল দোকান",
    locationType: "STORE",
    isDefault: true,
    status: "ACTIVE",
    phoneE164: "+8801712345678",
    version: 1,
  },
  {
    locationId: "l2",
    name: "পুরান গুদাম",
    locationType: "WAREHOUSE",
    isDefault: false,
    status: "ACTIVE",
    version: 2,
  },
];

async function renderPage(
  options: AccessOptions,
  locations: LocationResponse[] = LOCATIONS,
  status?: string,
): Promise<void> {
  requireOrgAccess.mockResolvedValue(accessFixture(options));
  fetchBusinessResource.mockResolvedValue({ data: locations });
  render(await LocationsPage({ orgSlug: "acme", searchParams: status ? { status } : {} }));
}

beforeEach(() => {
  requireOrgAccess.mockReset();
  fetchBusinessResource.mockReset();
});

describe("LocationsPage", () => {
  it("lists the locations with type, phone and status", async () => {
    await renderPage({ keys: ALL_WRITES });

    expect(screen.getAllByText(/মূল দোকান/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(banglaText("locations.type.warehouse")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("01712-345678").length).toBeGreaterThan(0);
  });

  it("asks the API for active locations by default and for archived ones with the chip", async () => {
    await renderPage({ keys: ALL_WRITES });
    expect(fetchBusinessResource.mock.calls[0]?.[0]).toContain("status=ACTIVE");

    await renderPage({ keys: ALL_WRITES }, [], "ARCHIVED");
    expect(fetchBusinessResource.mock.calls[1]?.[0]).toContain("status=ARCHIVED");
  });

  it("shows the empty sentence when there are no locations", async () => {
    await renderPage({ keys: ALL_WRITES }, []);

    expect(screen.getByText(withTerm("locations.empty"))).not.toBeNull();
  });

  it("offers add, edit and archive to someone with every permission at every location", async () => {
    await renderPage({ keys: ALL_WRITES });

    expect(screen.getByRole("button", { name: withTerm("locations.add") })).not.toBeNull();
    expect(screen.getAllByRole("button", { name: banglaText("locations.edit") })).toHaveLength(4);
    expect(screen.getAllByRole("button", { name: banglaText("locations.archive") })).toHaveLength(
      4,
    );
  });

  it("shows a member limited to some locations the list without create, edit or archive", async () => {
    await renderPage({ limitedKeys: ALL_WRITES });

    expect(screen.queryByRole("button", { name: withTerm("locations.add") })).toBeNull();
    expect(screen.queryByRole("button", { name: banglaText("locations.edit") })).toBeNull();
    expect(screen.queryByRole("button", { name: banglaText("locations.archive") })).toBeNull();
  });

  it("hides every write action in read-only mode", async () => {
    await renderPage({ keys: ALL_WRITES, canWrite: false });

    expect(screen.queryByRole("button", { name: withTerm("locations.add") })).toBeNull();
    expect(screen.queryByRole("button", { name: banglaText("locations.archive") })).toBeNull();
  });

  it("shows no list to someone who may not read locations", async () => {
    await renderPage({});

    expect(screen.getByText(banglaText("state.permissionDenied"))).not.toBeNull();
  });
});

describe("LocationsPage with a renamed term", () => {
  const OUTLET = { location: { bn: "আউটলেট", en: "Outlet" } };

  it("shows the business's word in the title, the add button and the empty sentence", async () => {
    await renderPage({ keys: ALL_WRITES, terms: OUTLET }, []);

    expect(screen.getAllByText("আউটলেট").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: withTerm("locations.add", "আউটলেট") }),
    ).not.toBeNull();
    expect(screen.getByText(withTerm("locations.empty", "আউটলেট"))).not.toBeNull();
    expect(screen.queryByText(banglaText("locations.title"))).toBeNull();
  });

  it("falls back to the catalog words when the business has no term", async () => {
    await renderPage({ keys: ALL_WRITES }, []);

    expect(screen.getByText(banglaText("locations.title"))).not.toBeNull();
    expect(screen.getByRole("button", { name: withTerm("locations.add") })).not.toBeNull();
  });
});
