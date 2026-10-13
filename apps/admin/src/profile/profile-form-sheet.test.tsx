import { I18nProvider } from "@banijjik/web-client/client";
// @vitest-environment jsdom
import { ERROR_CODE } from "@banijjik/contracts";
import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaText, banglaTranslator } from "../auth/test-helpers";
import { ApiError } from "../lib/api/api-error";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const updateProfile = vi.fn();
vi.mock("./profile-api", () => ({
  updateProfile: (...args: unknown[]) => updateProfile(...args),
}));

const { ProfileFormSheet } = await import("./profile-form-sheet");
const { profileLabelsOf } = await import("./profile-labels");

const labels = profileLabelsOf(banglaTranslator().t);
const INITIAL = {
  name: "রহিম ট্রেডার্স",
  defaultLocale: "bn" as const,
  legalName: "",
  legalType: "",
  businessPhone: "",
  businessEmail: "",
  line1: "",
  area: "",
  thana: "",
  district: "",
  postalCode: "",
  tradeLicenseNumber: "",
};

function renderSheet(onClose = vi.fn(), saved: Partial<typeof INITIAL> = {}) {
  render(
    <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
      <ProfileFormSheet
        organizationId="org-1"
        initial={{ ...INITIAL, ...saved }}
        version={4}
        labels={labels}
        onClose={onClose}
      />
    </I18nProvider>,
  );
  return onClose;
}

function field(label: string): HTMLElement {
  return screen.getByLabelText(new RegExp(label));
}

beforeEach(() => {
  updateProfile.mockReset();
  refresh.mockReset();
});

describe("ProfileFormSheet", () => {
  it("sends the version it read, then closes and reloads the page", async () => {
    updateProfile.mockResolvedValue({});
    const onClose = renderSheet();

    await userEvent.click(screen.getByRole("button", { name: labels.submit }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updateProfile).toHaveBeenCalledWith("org-1", {
      name: INITIAL.name,
      defaultLocale: "bn",
      version: 4,
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("asks for a name before calling the API", async () => {
    renderSheet();

    await userEvent.clear(field(labels.fields.name));
    await userEvent.click(screen.getByRole("button", { name: labels.submit }));

    expect((await screen.findByRole("alert")).textContent).toBe(banglaText("validation.required"));
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("shows a typed phone number as 01712-345678 and sends it as E.164", async () => {
    updateProfile.mockResolvedValue({});
    renderSheet();

    await userEvent.type(field(labels.fields.businessPhone), "+8801712345678");
    await userEvent.tab();
    expect((field(labels.fields.businessPhone) as HTMLInputElement).value).toBe("01712-345678");
    await userEvent.click(screen.getByRole("button", { name: labels.submit }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalled());
    expect(updateProfile.mock.calls[0]?.[1]).toMatchObject({
      profile: { phoneE164: "+8801712345678" },
    });
  });

  it("tells the person someone else changed the profile and offers a reload on a 409", async () => {
    updateProfile.mockRejectedValue(
      new ApiError({ status: 409, code: ERROR_CODE.CONFLICT, messageKey: "errors.conflict" }),
    );
    renderSheet();

    await userEvent.click(screen.getByRole("button", { name: labels.submit }));

    expect((await screen.findByText(labels.conflict)).textContent).toBe(labels.conflict);
    await userEvent.click(screen.getByRole("button", { name: labels.reload }));
    expect(refresh).toHaveBeenCalled();
  });

  it("sends null for a saved field the person emptied", async () => {
    updateProfile.mockResolvedValue({});
    renderSheet(vi.fn(), { legalName: "রহিম ট্রেডার্স লিমিটেড" });

    await userEvent.clear(field(labels.fields.legalName));
    await userEvent.click(screen.getByRole("button", { name: labels.submit }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalled());
    expect(updateProfile.mock.calls[0]?.[1]).toEqual({
      name: INITIAL.name,
      defaultLocale: "bn",
      profile: { legalName: null },
      version: 4,
    });
  });
});
