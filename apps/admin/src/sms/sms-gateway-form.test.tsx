// @vitest-environment jsdom
import { ERROR_CODE } from "@banijjik/contracts";
import { SMS_PROVIDER, SMS_SOURCE } from "@banijjik/contracts/sms";
import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import { I18nProvider } from "@banijjik/web-client/client";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaTranslator } from "../auth/test-helpers";
import { ApiError } from "../lib/api/api-error";
import type { SmsGatewayView } from "./sms-api";
import { smsSettingsLabelsOf } from "./sms-labels";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const apiFetch = vi.fn();
vi.mock("../lib/api/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

const { SmsGatewayForm } = await import("./sms-gateway-form");

const labels = smsSettingsLabelsOf(banglaTranslator().t);

const STORED_VIEW: SmsGatewayView = {
  enabled: true,
  activeProvider: SMS_PROVIDER.ADAREACH,
  adareach: { username: "akmi", senderId: "AKMI", hasPassword: true },
  bulksmsbd: null,
  version: 4,
  updatedAt: "2026-10-26T04:00:00.000Z",
  source: SMS_SOURCE.ORGANIZATION,
};

function renderForm(overrides: { canEdit?: boolean; view?: SmsGatewayView } = {}): void {
  render(
    <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
      <SmsGatewayForm
        organizationId="org-1"
        view={overrides.view ?? STORED_VIEW}
        labels={labels}
        canEdit={overrides.canEdit ?? true}
      />
    </I18nProvider>,
  );
}

describe("the SMS gateway form", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    refresh.mockReset();
  });

  it("shows the controls to read-only members as off, and no Save button", () => {
    renderForm({ canEdit: false });

    expect(screen.queryByRole("button", { name: labels.save })).toBeNull();
    expect(screen.getByText(labels.readOnly)).toBeTruthy();
    expect(
      (screen.getByLabelText(labels.adareach.username, { exact: false }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
  });

  it("shows the stored secret as saved and leaves its box empty", () => {
    renderForm();

    expect(screen.getByText(labels.secret.saved)).toBeTruthy();
    expect((screen.getByLabelText(labels.adareach.password) as HTMLInputElement).value).toBe("");
  });

  it("shows only the chosen provider's fields when the provider changes", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(screen.getByLabelText(labels.provider), SMS_PROVIDER.BULKSMSBD);

    expect(screen.getByLabelText(labels.bulksmsbd.senderId, { exact: false })).toBeTruthy();
    expect(screen.queryByLabelText(labels.adareach.username, { exact: false })).toBeNull();
  });

  it("keeps the stored password when the box is empty on save", async () => {
    const user = userEvent.setup();
    apiFetch.mockResolvedValue({ data: STORED_VIEW });
    renderForm();

    await user.click(screen.getByRole("button", { name: labels.save }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    const body = apiFetch.mock.calls[0]?.[1]?.body as { adareach: Record<string, unknown> };
    expect(body.adareach).not.toHaveProperty("password");
    expect(body.adareach).toMatchObject({ username: "akmi", senderId: "AKMI" });
  });

  it("asks for a reload when someone else changed the settings (409)", async () => {
    const user = userEvent.setup();
    apiFetch.mockRejectedValue(
      new ApiError({ status: 409, code: ERROR_CODE.CONFLICT, messageKey: "errors.conflict" }),
    );
    renderForm();

    await user.click(screen.getByRole("button", { name: labels.save }));

    expect(await screen.findByText(labels.conflict)).toBeTruthy();
  });
});
