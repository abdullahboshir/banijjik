// @vitest-environment jsdom
import { ERROR_CODE } from "@banijjik/contracts";
import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import { I18nProvider } from "@banijjik/web-client/client";
import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaText, banglaTranslator } from "../auth/test-helpers";
import { ApiError } from "../lib/api/api-error";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const updateProfile = vi.fn();
vi.mock("../profile/profile-api", () => ({
  updateProfile: (...args: unknown[]) => updateProfile(...args),
}));
const apiFetch = vi.fn();
vi.mock("../lib/api/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

import type { BrandingFormState } from "./branding-state";

const { BrandingForm } = await import("./branding-form");
const { brandingLabelsOf } = await import("./branding-labels");

const labels = brandingLabelsOf(banglaTranslator().t);
const EMPTY: BrandingFormState = {
  logoFileId: undefined,
  logoUrl: undefined,
  primaryColor: "",
  accentColor: "",
  tagline: "",
};
const GREEN_PRESET_NAME = banglaText("branding.preset.green");

function renderForm(overrides: { canEdit?: boolean; initial?: Partial<BrandingFormState> } = {}) {
  render(
    <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
      <BrandingForm
        organizationId="org-1"
        businessName="রহিম ট্রেডার্স"
        version={3}
        initial={{ ...EMPTY, ...overrides.initial }}
        labels={labels}
        canEdit={overrides.canEdit ?? true}
      />
    </I18nProvider>,
  );
}

function colourBox(kind: "primary" | "accent"): HTMLInputElement {
  return document.querySelector(`#branding-${kind}`) as HTMLInputElement;
}

function previewButton(): HTMLElement {
  return screen.getByTestId("branding-preview-button");
}

beforeEach(() => {
  updateProfile.mockReset();
  apiFetch.mockReset();
  refresh.mockReset();
});

describe("the colour presets", () => {
  it("shows every preset by name, and choosing one colours the preview and marks the swatch", async () => {
    renderForm();

    await userEvent.click(screen.getByRole("button", { name: GREEN_PRESET_NAME }));

    expect(previewButton().style.backgroundColor).toBe("rgb(21, 128, 61)");
    expect(screen.getByTestId("branding-preview-link").style.color).toBe("rgb(22, 163, 74)");
    expect(
      screen.getByRole("button", { name: GREEN_PRESET_NAME }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(1);
  });

  it("keeps each swatch a 44 px touch target", () => {
    renderForm();

    const swatch = screen.getByRole("button", { name: GREEN_PRESET_NAME });

    expect(swatch.className).toContain("size-11");
  });
});

describe("a custom colour", () => {
  async function openCustom(): Promise<void> {
    await userEvent.click(screen.getByRole("button", { name: labels.custom }));
  }

  it("shows a live contrast message and colours the preview only with a readable colour", async () => {
    renderForm();
    await openCustom();
    const box = colourBox("primary");

    await userEvent.type(box, "#ffffff");
    expect(screen.getByText(/1\.0:1/)).not.toBeNull();
    expect(previewButton().getAttribute("style")).toBeNull();

    await userEvent.clear(box);
    await userEvent.type(box, "#15803d");
    expect(screen.getByText(/5\.0:1/)).not.toBeNull();
    expect(previewButton().style.backgroundColor).toBe("rgb(21, 128, 61)");
  });

  it("asks less of the second colour than of the main one", async () => {
    renderForm();
    await openCustom();
    const primary = colourBox("primary");
    const accent = colourBox("accent");

    await userEvent.type(primary, "#0d9488");
    await userEvent.type(accent, "#0d9488");

    expect(screen.getAllByText(/3\.7:1/)).toHaveLength(2);
    expect(primary.getAttribute("aria-invalid")).toBe("true");
    expect(accent.getAttribute("aria-invalid")).toBe("false");
  });

  it("opens by itself when the stored colours are not a preset", () => {
    renderForm({ initial: { primaryColor: "#123456", accentColor: "#654321" } });

    expect(colourBox("primary").value).toBe("#123456");
    expect(colourBox("accent").value).toBe("#654321");
  });
});

describe("the preview", () => {
  it("shows the business name, the tagline and the logo as they are typed and chosen", async () => {
    renderForm({
      initial: { logoUrl: "http://localhost:4000/api/v1/public/files/f/medium", logoFileId: "f" },
    });

    await userEvent.type(screen.getByLabelText(labels.taglineLabel), "প্রতিদিন তাজা");

    const preview = screen.getByTestId("branding-preview");
    expect(within(preview).getByText("রহিম ট্রেডার্স")).not.toBeNull();
    expect(within(preview).getByText("প্রতিদিন তাজা")).not.toBeNull();
    expect(within(preview).getByAltText("রহিম ট্রেডার্স")).not.toBeNull();
  });

  it("counts the tagline against its 80 characters", async () => {
    renderForm();

    await userEvent.type(screen.getByLabelText(labels.taglineLabel), "abc");

    expect(screen.getByText("3/80")).not.toBeNull();
  });
});

describe("saving", () => {
  it("is off until something changes, then sends only the change with the version it read", async () => {
    updateProfile.mockResolvedValue({});
    renderForm();
    const save = screen.getByRole("button", { name: labels.save }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: GREEN_PRESET_NAME }));
    await userEvent.click(save);

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(updateProfile).toHaveBeenCalledWith("org-1", {
      version: 3,
      branding: { primaryColor: "#15803d", accentColor: "#16a34a" },
    });
  });

  it("uploads a picked logo for the LOGO purpose and previews it before saving", async () => {
    apiFetch.mockResolvedValue({ data: { fileId: "file-9" } });
    renderForm();
    const file = new File(["x"], "logo.png", { type: "image/png" });

    await userEvent.upload(document.querySelector("#branding-logo") as HTMLInputElement, file);

    await waitFor(() => expect(screen.getByAltText(labels.logo.alt)).not.toBeNull());
    const [path, options] = apiFetch.mock.calls[0] as [string, { method: string; body: FormData }];
    expect(path).toBe("/orgs/org-1/files");
    expect(options.method).toBe("POST");
    expect(options.body.get("purpose")).toBe("LOGO");
    expect(options.body.get("file")).toBeInstanceOf(File);
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("puts a logo the API refused beside the logo, not under the form", async () => {
    updateProfile.mockRejectedValue(
      new ApiError({
        status: 400,
        code: ERROR_CODE.VALIDATION_ERROR,
        messageKey: "errors.validation_error",
        details: {
          fields: [{ path: "branding.logoFileId", messageKey: "errors.file_reference_invalid" }],
        },
      }),
    );
    renderForm({ initial: { logoFileId: "gone", logoUrl: "http://x/y" } });
    await userEvent.type(screen.getByLabelText(labels.taglineLabel), "Hi");

    await userEvent.click(screen.getByRole("button", { name: labels.save }));

    expect(await screen.findByText(banglaText("errors.file_reference_invalid"))).not.toBeNull();
    expect(screen.queryByText(banglaText("errors.validation_error"))).toBeNull();
  });

  it("asks for a reload on a version conflict", async () => {
    updateProfile.mockRejectedValue(
      new ApiError({ status: 409, code: ERROR_CODE.CONFLICT, messageKey: "errors.conflict" }),
    );
    renderForm();
    await userEvent.type(screen.getByLabelText(labels.taglineLabel), "Hi");

    await userEvent.click(screen.getByRole("button", { name: labels.save }));

    expect(await screen.findByText(labels.conflict)).not.toBeNull();
    await userEvent.click(screen.getByRole("button", { name: labels.reload }));
    expect(refresh).toHaveBeenCalled();
  });

  it("refuses a pale colour in the form without calling the API", async () => {
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: labels.custom }));
    const primary = colourBox("primary");
    await userEvent.type(primary, "#ffffff");

    await userEvent.click(screen.getByRole("button", { name: labels.save }));

    expect(updateProfile).not.toHaveBeenCalled();
    expect(await screen.findByText(banglaText("validation.color_low_contrast"))).not.toBeNull();
  });
});

describe("without the permission to change it", () => {
  it("shows the branding read-only: a note, every control off, no Save", () => {
    renderForm({ canEdit: false, initial: { tagline: "Open to all" } });

    expect(screen.getByText(labels.readOnly)).not.toBeNull();
    expect(screen.queryByRole("button", { name: labels.save })).toBeNull();
    expect((screen.getByLabelText(labels.taglineLabel) as HTMLInputElement).disabled).toBe(true);
    expect(
      (screen.getByRole("button", { name: GREEN_PRESET_NAME }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByDisplayValue("Open to all")).not.toBeNull();
  });
});
