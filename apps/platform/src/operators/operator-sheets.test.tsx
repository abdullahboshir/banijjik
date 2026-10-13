// @vitest-environment jsdom
import { PLATFORM_ROLE } from "@banijjik/contracts";
import { ApiError } from "@banijjik/web-client";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pickLabels } from "../lib/labels";
import { banglaText, banglaTranslator, renderInBangla } from "../test-support/render-helpers";
import {
  OperatorAddButton,
  OperatorRowActions,
  type OperatorActionTarget,
} from "./operator-actions";
import { OPERATOR_LABEL_KEYS, type OperatorLabels } from "./operator-action-rules";

const { refresh, grantOperator, changeOperatorRoles, changeOperatorStatus } = vi.hoisted(() => ({
  refresh: vi.fn(),
  grantOperator: vi.fn(),
  changeOperatorRoles: vi.fn(),
  changeOperatorStatus: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../api/platform-api", () => ({
  grantOperator,
  changeOperatorRoles,
  changeOperatorStatus,
}));
vi.mock("../forms/announce-success", () => ({ announceSuccess: vi.fn() }));

const OPERATOR_ID = "01900000-0000-7000-8000-000000000099";
const EMAIL = "ada@example.com";
const REASON = "সাপোর্ট হিসেবে যোগ";

function labels(): OperatorLabels {
  return pickLabels(banglaTranslator().t, OPERATOR_LABEL_KEYS);
}

function activeRow(): OperatorActionTarget {
  return {
    platformOperatorId: OPERATOR_ID,
    version: 4,
    platformRoles: [PLATFORM_ROLE.SUPPORT],
    actions: ["changeRoles", "disable"],
  };
}

function refusal(messageKey: string, status = 422): ApiError {
  return new ApiError({ status, code: status === 409 ? "CONFLICT" : "BUSINESS_RULE", messageKey });
}

async function submitDialog(): Promise<void> {
  const dialog = screen.getByRole("dialog");
  await userEvent.click(dialog.querySelector("button[type=submit]") as HTMLElement);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("adding an operator", () => {
  async function openCreate(): Promise<void> {
    renderInBangla(<OperatorAddButton labels={labels()} />);
    await userEvent.click(
      screen.getByRole("button", { name: banglaText("platform.action.addOperator") }),
    );
    await screen.findByRole("dialog");
  }

  async function fillValid(): Promise<void> {
    await userEvent.type(
      screen.getByLabelText(banglaText("platform.field.operatorIdentifier"), { exact: false }),
      EMAIL,
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: banglaText("platform.role.SUPPORT") }),
    );
    await userEvent.type(
      screen.getByLabelText(banglaText("platform.field.reason"), { exact: false }),
      REASON,
    );
  }

  it("sends the identifier, the chosen role and the reason", async () => {
    grantOperator.mockResolvedValue({});
    await openCreate();
    await fillValid();
    await submitDialog();
    expect(grantOperator).toHaveBeenCalledWith({
      identifier: EMAIL,
      platformRoles: [PLATFORM_ROLE.SUPPORT],
      reason: REASON,
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("shows field errors and sends nothing when the reason, a role or the identifier is missing or bad", async () => {
    await openCreate();
    await userEvent.type(
      screen.getByLabelText(banglaText("platform.field.operatorIdentifier"), { exact: false }),
      EMAIL,
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: banglaText("platform.role.SUPPORT") }),
    );
    await submitDialog();
    expect(screen.getByText(banglaText("validation.required"))).not.toBeNull();

    await userEvent.type(
      screen.getByLabelText(banglaText("platform.field.reason"), { exact: false }),
      REASON,
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: banglaText("platform.role.SUPPORT") }),
    );
    await submitDialog();
    expect(screen.getAllByText(banglaText("validation.required")).length).toBeGreaterThan(0);

    await userEvent.click(
      screen.getByRole("checkbox", { name: banglaText("platform.role.SUPPORT") }),
    );
    await userEvent.clear(
      screen.getByLabelText(banglaText("platform.field.operatorIdentifier"), { exact: false }),
    );
    await userEvent.type(
      screen.getByLabelText(banglaText("platform.field.operatorIdentifier"), { exact: false }),
      "nope",
    );
    await submitDialog();
    expect(screen.getByText(banglaText("validation.invalid_format"))).not.toBeNull();
    expect(grantOperator).not.toHaveBeenCalled();
  });

  it("shows the translated message when the account is missing", async () => {
    grantOperator.mockRejectedValue(refusal("errors.operator_user_not_found"));
    await openCreate();
    await fillValid();
    await submitDialog();
    expect(await screen.findByText(banglaText("errors.operator_user_not_found"))).not.toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows the translated message when the person is already an operator", async () => {
    grantOperator.mockRejectedValue(refusal("errors.operator_exists", 409));
    await openCreate();
    await fillValid();
    await submitDialog();
    expect(await screen.findByText(banglaText("errors.operator_exists"))).not.toBeNull();
  });
});

describe("changing roles and status", () => {
  it("sends the current version with the roles", async () => {
    changeOperatorRoles.mockResolvedValue({});
    renderInBangla(<OperatorRowActions row={activeRow()} labels={labels()} />);
    await userEvent.click(
      screen.getByRole("button", { name: banglaText("platform.action.changeRoles") }),
    );
    await screen.findByRole("dialog");
    await userEvent.type(
      screen.getByLabelText(banglaText("platform.field.reason"), { exact: false }),
      REASON,
    );
    await submitDialog();
    expect(changeOperatorRoles).toHaveBeenCalledWith(OPERATOR_ID, {
      platformRoles: [PLATFORM_ROLE.SUPPORT],
      version: 4,
      reason: REASON,
    });
  });

  it("sends the version and the reason when disabling", async () => {
    changeOperatorStatus.mockResolvedValue({});
    renderInBangla(<OperatorRowActions row={activeRow()} labels={labels()} />);
    await userEvent.click(
      screen.getByRole("button", { name: banglaText("platform.action.disableOperator") }),
    );
    await screen.findByRole("dialog");
    expect(
      screen.getByText(banglaText("platform.sheet.disableOperator.description")),
    ).not.toBeNull();
    await userEvent.type(
      screen.getByLabelText(banglaText("platform.field.reason"), { exact: false }),
      REASON,
    );
    await submitDialog();
    expect(changeOperatorStatus).toHaveBeenCalledWith(OPERATOR_ID, "disable", {
      version: 4,
      reason: REASON,
    });
  });

  it("shows the conflict message when the version is stale", async () => {
    changeOperatorStatus.mockRejectedValue(refusal("errors.conflict", 409));
    renderInBangla(<OperatorRowActions row={activeRow()} labels={labels()} />);
    await userEvent.click(
      screen.getByRole("button", { name: banglaText("platform.action.disableOperator") }),
    );
    await screen.findByRole("dialog");
    await userEvent.type(
      screen.getByLabelText(banglaText("platform.field.reason"), { exact: false }),
      REASON,
    );
    await submitDialog();
    expect(await screen.findByText(banglaText("errors.conflict"))).not.toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });
});
