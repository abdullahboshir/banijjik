// @vitest-environment jsdom
import { ERROR_CODE } from "@banijjik/contracts";
import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import { I18nProvider } from "@banijjik/web-client/client";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaText } from "../auth/test-helpers";
import { staffProfileFields } from "../custom-fields/test-fixtures";
import type { CustomFieldsFormProps } from "../custom-fields/use-custom-fields-form";
import { ApiError } from "../lib/api/api-error";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const updateMember = vi.fn();
vi.mock("../lib/api/organization-api", () => ({
  updateMember: (...args: unknown[]) => updateMember(...args),
}));

const { EditMemberDetailsSheet } = await import("./edit-member-details-sheet");

const LABELS = {
  title: banglaText("staff.action.editDetails"),
  close: banglaText("shell.closeMenu"),
  save: banglaText("common.save"),
  conflict: banglaText("staff.conflict"),
  reload: banglaText("staff.reload"),
};

function customFieldsProps(overrides: Partial<CustomFieldsFormProps> = {}): CustomFieldsFormProps {
  return {
    fields: staffProfileFields(),
    stored: { emergency_contact: "+8801712345678", nid: "1234567890", medical_notes: "asthma" },
    canSeeSensitive: true,
    currencyCode: "BDT",
    title: banglaText("customFields.title"),
    hiddenHint: banglaText("customFields.hiddenHint"),
    ...overrides,
  };
}

function renderSheet(customFields: CustomFieldsFormProps, onClose = vi.fn()) {
  render(
    <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
      <EditMemberDetailsSheet
        organizationId="org-1"
        memberId="member-1"
        version={7}
        customFields={customFields}
        labels={LABELS}
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
  updateMember.mockReset();
  refresh.mockReset();
});

describe("EditMemberDetailsSheet", () => {
  it("sends only the details that changed, with the version it read, then closes and reloads", async () => {
    updateMember.mockResolvedValue({});
    const onClose = renderSheet(customFieldsProps());

    await userEvent.clear(field("জাতীয় পরিচয়পত্র"));
    await userEvent.type(field("জাতীয় পরিচয়পত্র"), "9999999999");
    await userEvent.click(screen.getByRole("button", { name: LABELS.save }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updateMember).toHaveBeenCalledWith("org-1", "member-1", {
      customFields: { nid: "9999999999" },
      version: 7,
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("closes without calling the API when nothing changed", async () => {
    const onClose = renderSheet(customFieldsProps());

    await userEvent.click(screen.getByRole("button", { name: LABELS.save }));

    expect(onClose).toHaveBeenCalled();
    expect(updateMember).not.toHaveBeenCalled();
  });

  it("leaves a hidden sensitive detail out of the form and out of the request", async () => {
    updateMember.mockResolvedValue({});
    renderSheet(
      customFieldsProps({
        canSeeSensitive: false,
        stored: { emergency_contact: "+8801712345678", nid: "1234567890" },
      }),
    );

    expect(screen.queryByLabelText(/চিকিৎসা নোট/)).toBeNull();
    await userEvent.clear(field("জাতীয় পরিচয়পত্র"));
    await userEvent.type(field("জাতীয় পরিচয়পত্র"), "1");
    await userEvent.click(screen.getByRole("button", { name: LABELS.save }));

    await waitFor(() => expect(updateMember).toHaveBeenCalled());
    expect(updateMember.mock.calls[0]?.[2]).toEqual({ customFields: { nid: "1" }, version: 7 });
  });

  it("asks for a required detail that was emptied, without calling the API", async () => {
    renderSheet(customFieldsProps());

    await userEvent.clear(field("জাতীয় পরিচয়পত্র"));
    await userEvent.click(screen.getByRole("button", { name: LABELS.save }));

    expect(await screen.findByText(banglaText("validation.required"))).toBeTruthy();
    expect(updateMember).not.toHaveBeenCalled();
  });

  it("shows a refusal of the API at the detail it names", async () => {
    updateMember.mockRejectedValue(
      new ApiError({
        status: 400,
        code: ERROR_CODE.VALIDATION_ERROR,
        messageKey: "errors.validation",
        details: {
          fields: [
            { path: "customFields.emergency_contact", messageKey: "validation.invalid_value" },
          ],
        },
      }),
    );
    renderSheet(customFieldsProps());

    await userEvent.type(field("জরুরি যোগাযোগ"), "1");
    await userEvent.click(screen.getByRole("button", { name: LABELS.save }));

    expect(await screen.findByText(banglaText("validation.invalid_value"))).toBeTruthy();
  });

  it("tells the person someone else changed the member and offers a reload on a 409", async () => {
    updateMember.mockRejectedValue(
      new ApiError({ status: 409, code: ERROR_CODE.CONFLICT, messageKey: "errors.conflict" }),
    );
    renderSheet(customFieldsProps());

    await userEvent.clear(field("জাতীয় পরিচয়পত্র"));
    await userEvent.type(field("জাতীয় পরিচয়পত্র"), "1");
    await userEvent.click(screen.getByRole("button", { name: LABELS.save }));

    expect(await screen.findByText(LABELS.conflict)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: LABELS.reload }));
    expect(refresh).toHaveBeenCalled();
  });
});
