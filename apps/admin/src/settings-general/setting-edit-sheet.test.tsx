// @vitest-environment jsdom
import { ERROR_CODE } from "@banijjik/contracts";
import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import { I18nProvider } from "@banijjik/web-client/client";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaText } from "../auth/test-helpers";
import { ApiError } from "../lib/api/api-error";
import type { SettingRowView } from "./setting-rows";
import { settingSheetLabelsOf } from "./setting-labels";
import { banglaTranslator } from "../auth/test-helpers";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const updateSettings = vi.fn();
vi.mock("../lib/api/tenant-config-api", () => ({
  updateSettings: (...args: unknown[]) => updateSettings(...args),
}));

const { SettingEditSheet } = await import("./setting-edit-sheet");

const labels = settingSheetLabelsOf(banglaTranslator().t);

function row(overrides: Partial<SettingRowView> = {}): SettingRowView {
  return {
    settingKey: "organization.digitScript",
    label: "অঙ্ক",
    description: undefined,
    valueText: "ইংরেজি",
    source: "SYSTEM",
    sourceLabel: "সিস্টেম ডিফল্ট",
    spec: { kind: "ENUM", values: ["LATIN", "BENGALI"] },
    initialText: "LATIN",
    options: [
      { value: "LATIN", label: "ইংরেজি" },
      { value: "BENGALI", label: "বাংলা" },
    ],
    version: undefined,
    locationId: undefined,
    canEdit: true,
    canReset: false,
    ...overrides,
  };
}

function renderSheet(setting: SettingRowView, onClose = vi.fn()) {
  render(
    <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
      <SettingEditSheet
        organizationId="org-1"
        setting={setting}
        labels={labels}
        onClose={onClose}
      />
    </I18nProvider>,
  );
  return onClose;
}

beforeEach(() => {
  updateSettings.mockReset();
  refresh.mockReset();
});

describe("SettingEditSheet", () => {
  it("sends the chosen value without a version for a setting no one has stored yet", async () => {
    updateSettings.mockResolvedValue({});
    const onClose = renderSheet(row());

    await userEvent.selectOptions(screen.getByRole("combobox"), "BENGALI");
    await userEvent.click(screen.getByRole("button", { name: labels.save }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updateSettings).toHaveBeenCalledWith("org-1", [
      { settingKey: "organization.digitScript", value: "BENGALI" },
    ]);
    expect(refresh).toHaveBeenCalled();
  });

  it("sends the version of the stored row and the location of a location row", async () => {
    updateSettings.mockResolvedValue({});
    renderSheet(row({ version: 4, locationId: "location-1", source: "LOCATION" }));

    await userEvent.selectOptions(screen.getByRole("combobox"), "BENGALI");
    await userEvent.click(screen.getByRole("button", { name: labels.save }));

    await waitFor(() => expect(updateSettings).toHaveBeenCalled());
    expect(updateSettings.mock.calls[0]?.[1]).toEqual([
      {
        settingKey: "organization.digitScript",
        value: "BENGALI",
        locationId: "location-1",
        version: 4,
      },
    ]);
  });

  it("sends null with the version to reset to the default", async () => {
    updateSettings.mockResolvedValue({});
    renderSheet(row({ version: 2, source: "ORGANIZATION", canReset: true }));

    await userEvent.click(screen.getByRole("button", { name: labels.reset }));

    await waitFor(() => expect(updateSettings).toHaveBeenCalled());
    expect(updateSettings.mock.calls[0]?.[1]).toEqual([
      { settingKey: "organization.digitScript", value: null, version: 2 },
    ]);
  });

  it("offers no reset when the value is inherited", () => {
    renderSheet(row({ canReset: false }));

    expect(screen.queryByRole("button", { name: labels.reset })).toBeNull();
  });

  it("asks for a value the spec accepts, before calling the API", async () => {
    renderSheet(
      row({
        spec: { kind: "INTEGER", min: 1, max: 10 },
        options: [],
        initialText: "5",
      }),
    );

    await userEvent.clear(screen.getByRole("textbox"));
    await userEvent.type(screen.getByRole("textbox"), "99");
    await userEvent.click(screen.getByRole("button", { name: labels.save }));

    expect(await screen.findByText(banglaText("validation.invalid_value"))).toBeTruthy();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("shows the message of a 403 under the form", async () => {
    updateSettings.mockRejectedValue(
      new ApiError({ status: 403, code: ERROR_CODE.FORBIDDEN, messageKey: "errors.forbidden" }),
    );
    renderSheet(row());

    await userEvent.click(screen.getByRole("button", { name: labels.save }));

    expect(await screen.findByText(banglaText("errors.forbidden"))).toBeTruthy();
  });

  it("tells the person someone else changed it and offers a reload on a 409", async () => {
    updateSettings.mockRejectedValue(
      new ApiError({ status: 409, code: ERROR_CODE.CONFLICT, messageKey: "errors.conflict" }),
    );
    renderSheet(row({ version: 1, source: "ORGANIZATION" }));

    await userEvent.click(screen.getByRole("button", { name: labels.save }));

    expect(await screen.findByText(labels.conflict)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: labels.reload }));
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the message of a 422 under the form", async () => {
    updateSettings.mockRejectedValue(
      new ApiError({
        status: 422,
        code: ERROR_CODE.BUSINESS_RULE,
        messageKey: "errors.setting_not_location_scoped",
      }),
    );
    renderSheet(row({ locationId: "location-1" }));

    await userEvent.click(screen.getByRole("button", { name: labels.save }));

    expect(await screen.findByText(banglaText("errors.setting_not_location_scoped"))).toBeTruthy();
  });
});
