// @vitest-environment jsdom
import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import { I18nProvider } from "@banijjik/web-client/client";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { banglaTranslator } from "../auth/test-helpers";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { PosDeviceAddButton } = await import("./pos-device-add-button");
const { deviceAddLabelsOf } = await import("./pos-devices-labels");

const { t } = banglaTranslator();
const labels = deviceAddLabelsOf(t, 1);
const LOCATIONS = [{ locationId: "0190a6a0-0000-7000-8000-000000000001", name: "মূল শাখা" }];

function renderButton(isOff: boolean, locations = LOCATIONS): void {
  render(
    <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
      <PosDeviceAddButton
        organizationId="org-1"
        labels={labels}
        locations={locations}
        defaultLocationId={locations[0]?.locationId}
        isOff={isOff}
      />
    </I18nProvider>,
  );
}

describe("PosDeviceAddButton", () => {
  it("is off at the package limit, so the add cannot be started", () => {
    renderButton(true);

    expect(screen.getByRole("button", { name: labels.add }).hasAttribute("disabled")).toBe(true);
  });

  it("is off when the business has no location to put a till at", () => {
    renderButton(false, []);

    expect(screen.getByRole("button", { name: labels.add }).hasAttribute("disabled")).toBe(true);
  });

  it("is on below the limit", () => {
    renderButton(false);

    expect(screen.getByRole("button", { name: labels.add }).hasAttribute("disabled")).toBe(false);
  });
});
