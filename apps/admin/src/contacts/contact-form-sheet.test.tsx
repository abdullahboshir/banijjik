// @vitest-environment jsdom
import { CUSTOM_FIELD_TYPE, ERROR_CODE, type EffectiveCustomField } from "@banijjik/contracts";
import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import { I18nProvider } from "@banijjik/web-client/client";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaText } from "../auth/test-helpers";
import { effectiveField } from "../custom-fields/test-fixtures";
import { ApiError } from "../lib/api/api-error";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
const createContact = vi.fn();
const updateContact = vi.fn();
const searchContacts = vi.fn();
vi.mock("./contact-api", () => ({
  createContact: (...args: unknown[]) => createContact(...args),
  updateContact: (...args: unknown[]) => updateContact(...args),
  searchContacts: (...args: unknown[]) => searchContacts(...args),
}));

const { ContactFormSheet } = await import("./contact-form-sheet");

const LABELS = {
  createTitle: "নতুন ছাত্র-ছাত্রী",
  editTitle: "ছাত্র-ছাত্রী সম্পাদনা",
  close: banglaText("shell.closeMenu"),
  save: banglaText("common.save"),
  conflict: banglaText("settings.conflict"),
  reload: banglaText("settings.reload"),
  name: "নাম",
  phone: "ফোন",
  phoneHint: "যেমন ০১৭১২৩৪৫৬৭৮",
  email: "ইমেইল",
  roles: "ধরন",
  duplicate: "এই ফোন নম্বরে আগেই একটি ছাত্র-ছাত্রী আছে।",
  openExisting: "সেটি খুলুন",
};

const ROLE_OPTIONS = [
  { role: "CUSTOMER" as const, label: "ছাত্র-ছাত্রী" },
  { role: "RELATED" as const, label: "অভিভাবক" },
];

function coachingFields(): EffectiveCustomField[] {
  return [
    effectiveField({
      fieldKey: "class_level",
      fieldType: CUSTOM_FIELD_TYPE.TEXT,
      entityType: "contact",
      isRequired: true,
      label: { bn: "শ্রেণি", en: "Class" },
      appliesToContactRoles: ["CUSTOMER"],
    }),
    effectiveField({
      fieldKey: "note",
      fieldType: CUSTOM_FIELD_TYPE.TEXT,
      entityType: "contact",
      label: { bn: "মন্তব্য", en: "Note" },
    }),
  ];
}

function renderSheet(overrides: Record<string, unknown> = {}, onClose = vi.fn()) {
  render(
    <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
      <ContactFormSheet
        organizationId="org-1"
        roleOptions={ROLE_OPTIONS}
        defaultRoles={["CUSTOMER"]}
        customFields={{
          fields: coachingFields(),
          stored: {},
          canSeeSensitive: true,
          currencyCode: "BDT",
          title: "অতিরিক্ত তথ্য",
          hiddenHint: "",
        }}
        listPath="/acme/contacts"
        labels={LABELS}
        onClose={onClose}
        {...overrides}
      />
    </I18nProvider>,
  );
  return onClose;
}

const chip = (name: string) => screen.getByRole("button", { name });

beforeEach(() => {
  createContact.mockReset();
  updateContact.mockReset();
  searchContacts.mockReset();
  refresh.mockReset();
});

describe("ContactFormSheet", () => {
  it("shows the roles the template allows as chips, the first one chosen", () => {
    renderSheet();

    expect(chip("ছাত্র-ছাত্রী").getAttribute("aria-pressed")).toBe("true");
    expect(chip("অভিভাবক").getAttribute("aria-pressed")).toBe("false");
  });

  it("shows the fields of the chosen roles and refreshes them when the roles change", async () => {
    renderSheet();
    expect(screen.getByLabelText(/শ্রেণি/u)).toBeTruthy();

    await userEvent.click(chip("ছাত্র-ছাত্রী"));
    await userEvent.click(chip("অভিভাবক"));

    expect(screen.queryByLabelText(/শ্রেণি/u)).toBeNull();
    expect(screen.getByLabelText(/মন্তব্য/u)).toBeTruthy();
  });

  it("adds a guardian by hand without the student's fields", async () => {
    createContact.mockResolvedValue({});
    const onClose = renderSheet();

    await userEvent.click(chip("ছাত্র-ছাত্রী"));
    await userEvent.click(chip("অভিভাবক"));
    await userEvent.type(screen.getByLabelText(new RegExp(LABELS.name, "u")), "আব্দুল করিম");
    await userEvent.click(screen.getByRole("button", { name: LABELS.save }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(createContact.mock.calls[0]?.[1]).toEqual({
      contactType: "PERSON",
      contactRoles: ["RELATED"],
      name: "আব্দুল করিম",
    });
    expect(typeof createContact.mock.calls[0]?.[2]).toBe("string");
  });

  it("checks the inputs and the required details before it sends anything", async () => {
    renderSheet();

    await userEvent.click(screen.getByRole("button", { name: LABELS.save }));

    expect((await screen.findAllByText(banglaText("contacts.form.nameOrPhone"))).length).toBe(1);
    expect(screen.getAllByText(banglaText("validation.required")).length).toBeGreaterThan(0);
    expect(createContact).not.toHaveBeenCalled();
  });

  it("answers a known phone with the existing contact and an Open link", async () => {
    createContact.mockRejectedValue(
      new ApiError({
        status: 409,
        code: ERROR_CODE.CONFLICT,
        messageKey: "errors.contact_duplicate",
        details: { contactId: "existing-1" },
      }),
    );
    const onClose = renderSheet();

    await userEvent.type(screen.getByLabelText(new RegExp(LABELS.phone, "u")), "01712345678");
    await userEvent.type(screen.getByLabelText(/শ্রেণি/u), "SSC");
    await userEvent.click(screen.getByRole("button", { name: LABELS.save }));

    expect(await screen.findByText(LABELS.duplicate)).toBeTruthy();
    expect(screen.getByRole("link", { name: LABELS.openExisting }).getAttribute("href")).toBe(
      "/acme/contacts/existing-1",
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("edits a contact: only what changed goes out, with the version it read", async () => {
    updateContact.mockResolvedValue({});
    const onClose = renderSheet({
      contact: {
        contactId: "c-1",
        version: 5,
        name: "রহিম",
        phone: "+8801712345678",
        email: "",
        roles: ["RELATED"],
      },
    });

    const name = screen.getByLabelText(new RegExp(LABELS.name, "u"));
    await userEvent.clear(name);
    await userEvent.type(name, "রহিম উদ্দিন");
    await userEvent.click(screen.getByRole("button", { name: LABELS.save }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updateContact).toHaveBeenCalledWith("org-1", "c-1", {
      name: "রহিম উদ্দিন",
      version: 5,
    });
  });
});
