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
const fetchBusinessResourceIfAllowed = vi.fn();
vi.mock("../lib/api/server-resource", () => ({
  fetchBusinessResource: (...args: unknown[]) => fetchBusinessResource(...args),
  fetchBusinessResourceIfAllowed: (...args: unknown[]) => fetchBusinessResourceIfAllowed(...args),
}));

const { ProfilePage } = await import("./profile-page");

const PROFILE = {
  organizationId: "org-1",
  slug: "acme",
  name: "রহিম ট্রেডার্স",
  defaultLocale: "bn",
  timezone: "Asia/Dhaka",
  countryCode: "BD",
  currencyCode: "BDT",
  profile: { phoneE164: "+8801712345678" },
  version: 3,
};

function location(locationId: string, name: string): LocationResponse {
  return { locationId, name, locationType: "STORE", isDefault: true, status: "ACTIVE", version: 1 };
}

async function renderPage(
  options: AccessOptions,
  locations: LocationResponse[] | undefined,
): Promise<void> {
  requireOrgAccess.mockResolvedValue(accessFixture(options));
  fetchBusinessResource.mockResolvedValue({ data: PROFILE });
  fetchBusinessResourceIfAllowed.mockResolvedValue(locations);
  render(await ProfilePage({ orgSlug: "acme" }));
}

beforeEach(() => {
  requireOrgAccess.mockReset();
});

describe("ProfilePage", () => {
  it("shows the details with the phone the way people write it", async () => {
    await renderPage({}, [location("l1", "মূল দোকান")]);

    expect(screen.getByText("01712-345678")).not.toBeNull();
    expect(screen.getByText("Asia/Dhaka")).not.toBeNull();
  });

  it("offers the edit button with the permission", async () => {
    await renderPage({ keys: [PERMISSION_KEY.ORGANIZATION_PROFILE_UPDATE] }, []);

    expect(screen.getByRole("button", { name: banglaText("profile.edit") })).not.toBeNull();
  });

  it("hides the edit button without the permission, so the details are read-only", async () => {
    await renderPage({}, []);

    expect(screen.queryByRole("button", { name: banglaText("profile.edit") })).toBeNull();
  });

  it("hides the edit button in read-only mode even with the permission", async () => {
    await renderPage({ keys: [PERMISSION_KEY.ORGANIZATION_PROFILE_UPDATE], canWrite: false }, []);

    expect(screen.queryByRole("button", { name: banglaText("profile.edit") })).toBeNull();
  });

  it("lets the owner of one location add a second one from the Locations section", async () => {
    await renderPage({ keys: [PERMISSION_KEY.ORGANIZATION_LOCATION_CREATE] }, [
      location("l1", "মূল দোকান"),
    ]);

    expect(screen.getByText(/মূল দোকান/)).not.toBeNull();
    expect(
      screen.getByRole("button", { name: banglaText("profile.locations.add") }),
    ).not.toBeNull();
  });

  it("offers no add action to someone who may create locations at one location only", async () => {
    await renderPage({ limitedKeys: [PERMISSION_KEY.ORGANIZATION_LOCATION_CREATE] }, [
      location("l1", "মূল দোকান"),
    ]);

    expect(screen.queryByRole("button", { name: banglaText("profile.locations.add") })).toBeNull();
  });

  it("leaves the Locations section out when the caller may not read locations", async () => {
    await renderPage({}, undefined);

    expect(screen.queryByText(banglaText("profile.locations.title"))).toBeNull();
  });
});
