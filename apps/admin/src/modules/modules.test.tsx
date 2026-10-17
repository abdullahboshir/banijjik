// @vitest-environment jsdom
import { ERROR_CODE, PERMISSION_KEY, type TenantModuleView } from "@banijjik/contracts";
import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import { I18nProvider } from "@banijjik/web-client/client";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaText, banglaTranslator } from "../auth/test-helpers";
import { ApiError } from "../lib/api/api-error";
import { accessFixture, type AccessOptions } from "../settings/test-fixtures";
import { moduleSheetLabelsOf } from "./module-labels";
import { toModuleRows } from "./module-rows";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const switchModule = vi.fn();
vi.mock("../lib/api/tenant-config-api", () => ({
  switchModule: (...args: unknown[]) => switchModule(...args),
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

const { ModuleSwitchSheet } = await import("./module-switch-sheet");
const { ModulesPage } = await import("./modules-page");

const { t } = banglaTranslator();
const labels = moduleSheetLabelsOf(t);

function aModule(overrides: Partial<TenantModuleView> = {}): TenantModuleView {
  return {
    moduleKey: "sms",
    moduleClass: "OPTIONAL",
    isEffective: true,
    tenantCanDisable: true,
    isDisabledByTenant: false,
    requiredBy: [],
    ...overrides,
  };
}

function rowOf(module: TenantModuleView, canEdit = true) {
  const [row] = toModuleRows([module], canEdit, t);
  if (row === undefined) throw new Error("no row");
  return row;
}

beforeEach(() => {
  switchModule.mockReset();
  refresh.mockReset();
  requireOrgAccess.mockReset();
  fetchBusinessResource.mockReset();
});

describe("toModuleRows", () => {
  it("turns off a module that is on and allows it, and on one the business turned off", () => {
    expect(rowOf(aModule()).action).toBe("disable");
    expect(rowOf(aModule({ isEffective: false, isDisabledByTenant: true })).action).toBe("enable");
  });

  it("offers no switch for a module the tenant cannot disable, one outside the package, or without the permission", () => {
    expect(rowOf(aModule({ tenantCanDisable: false })).action).toBeUndefined();
    expect(rowOf(aModule({ isEffective: false })).action).toBeUndefined();
    expect(rowOf(aModule(), false).action).toBeUndefined();
  });

  it("names the modules that need this one and locks the switch", () => {
    const row = rowOf(aModule({ moduleKey: "contact", requiredBy: ["sales"] }));

    expect(row.isLockedByDependents).toBe(true);
    expect(row.neededBy).toEqual([banglaText("module.sales")]);
  });

  it("says Off by you or Not in your package", () => {
    expect(rowOf(aModule({ isDisabledByTenant: true })).status).toBe("OFF_BY_YOU");
    expect(rowOf(aModule({ isEffective: false })).status).toBe("NOT_IN_PACKAGE");
  });
});

describe("ModuleSwitchSheet", () => {
  function renderSheet(module: TenantModuleView, onClose = vi.fn()) {
    render(
      <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
        <ModuleSwitchSheet
          organizationId="org-1"
          module={rowOf(module)}
          labels={labels}
          onClose={onClose}
        />
      </I18nProvider>,
    );
    return onClose;
  }

  it("sends the reason with the disable switch, then closes and reloads", async () => {
    switchModule.mockResolvedValue({});
    const onClose = renderSheet(aModule());

    await userEvent.type(screen.getByLabelText(new RegExp(labels.reason)), " ব্যবহার হয় না ");
    await userEvent.click(screen.getByRole("button", { name: labels.turnOff }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(switchModule).toHaveBeenCalledWith({
      organizationId: "org-1",
      moduleKey: "sms",
      action: "disable",
      reason: "ব্যবহার হয় না",
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("sends enable for a module the business turned off", async () => {
    switchModule.mockResolvedValue({});
    renderSheet(aModule({ isEffective: false, isDisabledByTenant: true }));

    await userEvent.type(screen.getByLabelText(new RegExp(labels.reason)), "আবার দরকার");
    await userEvent.click(screen.getByRole("button", { name: labels.turnOn }));

    await waitFor(() => expect(switchModule).toHaveBeenCalled());
    expect(switchModule.mock.calls[0]?.[0]).toMatchObject({ action: "enable" });
  });

  it("asks for a reason before calling the API", async () => {
    renderSheet(aModule());

    await userEvent.click(screen.getByRole("button", { name: labels.turnOff }));

    expect(await screen.findByText(banglaText("validation.required"))).toBeTruthy();
    expect(switchModule).not.toHaveBeenCalled();
  });

  it("shows the message of a 422 when another module needs it", async () => {
    switchModule.mockRejectedValue(
      new ApiError({
        status: 422,
        code: ERROR_CODE.BUSINESS_RULE,
        messageKey: "errors.module_required_by",
      }),
    );
    renderSheet(aModule());

    await userEvent.type(screen.getByLabelText(new RegExp(labels.reason)), "কারণ");
    await userEvent.click(screen.getByRole("button", { name: labels.turnOff }));

    expect(await screen.findByText(banglaText("errors.module_required_by"))).toBeTruthy();
  });
});

describe("ModulesPage", () => {
  async function renderPage(options: AccessOptions, modules: TenantModuleView[]) {
    requireOrgAccess.mockResolvedValue(accessFixture(options));
    fetchBusinessResource.mockResolvedValue({ data: modules });
    render(await ModulesPage({ orgSlug: "acme" }));
  }

  it("shows the rows read-only when no module can be switched", async () => {
    await renderPage(
      { keys: [PERMISSION_KEY.SETTINGS_SETTING_READ, PERMISSION_KEY.SETTINGS_MODULE_UPDATE] },
      [aModule({ moduleKey: "organization", moduleClass: "SYSTEM", tenantCanDisable: false })],
    );

    expect(screen.getAllByText(banglaText("module.organization")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: banglaText("modules.turnOff") })).toBeNull();
  });

  it("offers Turn off to someone with the key at every location, and disables it while another module needs it", async () => {
    await renderPage(
      { keys: [PERMISSION_KEY.SETTINGS_SETTING_READ, PERMISSION_KEY.SETTINGS_MODULE_UPDATE] },
      [aModule(), aModule({ moduleKey: "contact", requiredBy: ["sales"] })],
    );

    const buttons = screen.getAllByRole("button", { name: banglaText("modules.turnOff") });
    expect(buttons.some((button) => !(button as HTMLButtonElement).disabled)).toBe(true);
    expect(buttons.some((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.getAllByText(new RegExp(banglaText("module.sales"))).length).toBeGreaterThan(0);
  });

  it("offers no switch to a person limited to one location", async () => {
    await renderPage(
      {
        keys: [PERMISSION_KEY.SETTINGS_SETTING_READ],
        limitedKeys: [PERMISSION_KEY.SETTINGS_MODULE_UPDATE],
      },
      [aModule()],
    );

    expect(screen.queryByRole("button", { name: banglaText("modules.turnOff") })).toBeNull();
  });
});
