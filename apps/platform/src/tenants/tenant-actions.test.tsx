// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ApiError } from "@banijjik/web-client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pickLabels } from "../lib/labels";
import { BILLING, SUPER_ADMIN, SUPPORT, tenantDetail } from "../test-support/fixtures";
import { banglaText, banglaTranslator, renderInBangla } from "../test-support/render-helpers";
import {
  TENANT_ACTION_LABEL_KEYS,
  availableTenantActions,
  type TenantActionContext,
} from "./tenant-action-labels";

const { refresh, changeTenantStatus, extendTrial, createModuleOverride } = vi.hoisted(() => ({
  refresh: vi.fn(),
  changeTenantStatus: vi.fn(),
  extendTrial: vi.fn(),
  createModuleOverride: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../api/platform-api", () => ({ changeTenantStatus, extendTrial, createModuleOverride }));
vi.mock("../forms/announce-success", () => ({ announceSuccess: vi.fn() }));

const { TenantActions } = await import("./tenant-actions");

const ORGANIZATION_ID = tenantDetail().organizationId;

function context(): TenantActionContext {
  return {
    organizationId: ORGANIZATION_ID,
    currentBasePackageId: undefined,
    currentAddOnPackageIds: [],
    basePackages: [],
    addOnPackages: [],
    modules: [{ moduleKey: "pos", label: "POS" }],
    labels: pickLabels(banglaTranslator().t, TENANT_ACTION_LABEL_KEYS, { name: "Acme" }),
  };
}

function refusal(messageKey: string): ApiError {
  return new ApiError({ status: 422, code: "BUSINESS_RULE", messageKey });
}

beforeEach(() => {
  vi.clearAllMocks();
});

function buttonNames(): string[] {
  return screen.queryAllByRole("button").map((button) => button.textContent ?? "");
}

describe("TenantActions by permission", () => {
  it("shows a super admin every action of an active trialing tenant", () => {
    renderInBangla(
      <TenantActions
        actions={availableTenantActions(SUPER_ADMIN, tenantDetail())}
        context={context()}
      />,
    );
    expect(buttonNames()).toEqual(
      ["suspend", "extendTrial", "changePackage", "grantModule", "revokeModule"].map((kind) =>
        banglaText(`platform.action.${kind}`),
      ),
    );
  });

  it("shows support only the suspend button", () => {
    renderInBangla(
      <TenantActions
        actions={availableTenantActions(SUPPORT, tenantDetail())}
        context={context()}
      />,
    );
    expect(buttonNames()).toEqual([banglaText("platform.action.suspend")]);
  });

  it("shows billing no suspend button", () => {
    renderInBangla(
      <TenantActions
        actions={availableTenantActions(BILLING, tenantDetail())}
        context={context()}
      />,
    );
    expect(buttonNames()).not.toContain(banglaText("platform.action.suspend"));
  });

  it("renders nothing for an operator who may do nothing here", () => {
    renderInBangla(<TenantActions actions={[]} context={context()} />);
    expect(buttonNames()).toEqual([]);
  });
});

describe("the suspend sheet", () => {
  async function openSuspend(): Promise<void> {
    renderInBangla(<TenantActions actions={["suspend"]} context={context()} />);
    await userEvent.click(
      screen.getByRole("button", { name: banglaText("platform.action.suspend") }),
    );
    await screen.findByRole("dialog");
  }

  it("says what the tenant's staff will see", async () => {
    await openSuspend();
    expect(screen.getByText(banglaText("platform.sheet.suspend.description"))).not.toBeNull();
  });

  it("needs a reason and does not call the API without one", async () => {
    await openSuspend();
    const dialog = screen.getByRole("dialog");
    const buttons = Array.from(dialog.querySelectorAll("button[type=submit]"));
    await userEvent.click(buttons[0] as HTMLElement);
    expect(screen.getByText(banglaText("validation.required"))).not.toBeNull();
    expect(changeTenantStatus).not.toHaveBeenCalled();
  });

  it("suspends with the reason, then reloads the page data", async () => {
    changeTenantStatus.mockResolvedValue({});
    await openSuspend();
    await userEvent.type(
      screen.getByLabelText(banglaText("platform.field.reason"), { exact: false }),
      "ফি বকেয়া",
    );
    const dialog = screen.getByRole("dialog");
    await userEvent.click(dialog.querySelector("button[type=submit]") as HTMLElement);
    expect(changeTenantStatus).toHaveBeenCalledWith(ORGANIZATION_ID, "suspend", {
      reason: "ফি বকেয়া",
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the message of an API refusal inside the sheet", async () => {
    changeTenantStatus.mockRejectedValue(refusal("errors.invalid_transition"));
    await openSuspend();
    await userEvent.type(
      screen.getByLabelText(banglaText("platform.field.reason"), { exact: false }),
      "x",
    );
    const dialog = screen.getByRole("dialog");
    await userEvent.click(dialog.querySelector("button[type=submit]") as HTMLElement);
    expect(await screen.findByText(banglaText("errors.invalid_transition"))).not.toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("the extend-trial sheet", () => {
  async function openExtend(): Promise<HTMLElement> {
    renderInBangla(<TenantActions actions={["extendTrial"]} context={context()} />);
    await userEvent.click(
      screen.getByRole("button", { name: banglaText("platform.action.extendTrial") }),
    );
    return screen.findByRole("dialog");
  }

  it("refuses days outside 1 to 30", async () => {
    const dialog = await openExtend();
    await userEvent.type(
      screen.getByLabelText(banglaText("platform.field.days"), { exact: false }),
      "31",
    );
    await userEvent.type(
      screen.getByLabelText(banglaText("platform.field.reason"), { exact: false }),
      "x",
    );
    await userEvent.click(dialog.querySelector("button[type=submit]") as HTMLElement);
    expect(screen.getByText(banglaText("validation.too_big"))).not.toBeNull();
    expect(extendTrial).not.toHaveBeenCalled();
  });

  it("extends the trial with days and reason", async () => {
    extendTrial.mockResolvedValue({});
    const dialog = await openExtend();
    await userEvent.type(
      screen.getByLabelText(banglaText("platform.field.days"), { exact: false }),
      "7",
    );
    await userEvent.type(
      screen.getByLabelText(banglaText("platform.field.reason"), { exact: false }),
      "demo",
    );
    await userEvent.click(dialog.querySelector("button[type=submit]") as HTMLElement);
    expect(extendTrial).toHaveBeenCalledWith(ORGANIZATION_ID, { days: 7, reason: "demo" });
  });
});

describe("the grant-module sheet", () => {
  it("grants the chosen module with the reason and the expiry date", async () => {
    createModuleOverride.mockResolvedValue({});
    renderInBangla(<TenantActions actions={["grantModule"]} context={context()} />);
    await userEvent.click(
      screen.getByRole("button", { name: banglaText("platform.action.grantModule") }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.selectOptions(screen.getByRole("combobox"), "pos");
    await userEvent.type(
      screen.getByLabelText(banglaText("platform.field.reason"), { exact: false }),
      "pilot",
    );
    await userEvent.type(
      screen.getByLabelText(banglaText("platform.field.expiresAt"), { exact: false }),
      "2099-01-01",
    );
    await userEvent.click(dialog.querySelector("button[type=submit]") as HTMLElement);
    expect(createModuleOverride).toHaveBeenCalledWith(ORGANIZATION_ID, {
      moduleKey: "pos",
      effect: "PLATFORM_GRANT",
      reason: "pilot",
      expiresAt: "2099-01-01",
    });
  });
});
