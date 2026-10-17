// @vitest-environment jsdom
import { PERMISSION_KEY, type LocationResponse, type SettingsResponse } from "@banijjik/contracts";
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

const { SettingsGeneralPage } = await import("./settings-general-page");

const READ = PERMISSION_KEY.SETTINGS_SETTING_READ;
const UPDATE = PERMISSION_KEY.SETTINGS_SETTING_UPDATE;

const SETTINGS: SettingsResponse = {
  settings: {
    "notification.probeFlag": { value: false, source: "SYSTEM" },
    "organization.digitScript": { value: "BENGALI", source: "ORGANIZATION", version: 3 },
  },
  definitions: {
    "notification.probeFlag": { value: { kind: "BOOLEAN" }, allowsLocationOverride: true },
    "organization.digitScript": {
      value: { kind: "ENUM", values: ["LATIN", "BENGALI"] },
      allowsLocationOverride: false,
    },
  },
};
const LOCATIONS = [
  { locationId: "location-1", name: "মূল দোকান" },
  { locationId: "location-2", name: "দ্বিতীয় শাখা" },
] as LocationResponse[];

async function renderPage(
  options: AccessOptions,
  searchParams: Record<string, string> = {},
  locations: LocationResponse[] | undefined = LOCATIONS,
): Promise<void> {
  requireOrgAccess.mockResolvedValue(accessFixture(options));
  fetchBusinessResource.mockResolvedValue({ data: SETTINGS });
  fetchBusinessResourceIfAllowed.mockResolvedValue(locations);
  render(await SettingsGeneralPage({ orgSlug: "acme", searchParams }));
}

beforeEach(() => {
  requireOrgAccess.mockReset();
  fetchBusinessResource.mockReset();
  fetchBusinessResourceIfAllowed.mockReset();
});

describe("SettingsGeneralPage", () => {
  it("lists each setting with its value and where the value comes from", async () => {
    await renderPage({ keys: [READ] });

    expect(
      screen.getAllByText(banglaText("setting.organization.digitScript")).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(banglaText("setting.organization.digitScript.BENGALI")).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(banglaText("settings.source.ORGANIZATION")).length).toBeGreaterThan(
      0,
    );
  });

  it("offers Change to someone who holds the update key at every location", async () => {
    await renderPage({ keys: [READ, UPDATE] });

    expect(
      screen.getAllByRole("button", { name: banglaText("settings.general.change") }),
    ).toHaveLength(4);
  });

  it("shows a manager of one location no Change button on the business level", async () => {
    await renderPage({ keys: [READ], limitedKeys: [UPDATE] });

    expect(
      screen.queryByRole("button", { name: banglaText("settings.general.change") }),
    ).toBeNull();
  });

  it("hides Change in read-only mode", async () => {
    await renderPage({ keys: [READ, UPDATE], canWrite: false });

    expect(
      screen.queryByRole("button", { name: banglaText("settings.general.change") }),
    ).toBeNull();
  });

  it("shows no list to someone who may not read settings", async () => {
    await renderPage({});

    expect(screen.getByText(banglaText("state.permissionDenied"))).not.toBeNull();
  });

  it("offers a location filter when a setting can vary by location", async () => {
    await renderPage({ keys: [READ, UPDATE] });

    expect(screen.getByRole("link", { name: "দ্বিতীয় শাখা" })).not.toBeNull();
  });

  it("shows only the settings a location may override on the location level, editable with the key at that location", async () => {
    await renderPage({ keys: [READ], limitedKeys: [UPDATE] }, { location: "location-1" });

    expect(fetchBusinessResource.mock.calls[1]?.[0]).toContain("settings?location=location-1");
    expect(screen.queryByText(banglaText("setting.organization.digitScript"))).toBeNull();
    expect(
      screen.getAllByRole("button", { name: banglaText("settings.general.change") }),
    ).toHaveLength(2);
  });
});
