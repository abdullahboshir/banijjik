// @vitest-environment jsdom
import { ERROR_CODE, PERMISSION_KEY, type EffectiveCustomField } from "@banijjik/contracts";
import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import { I18nProvider } from "@banijjik/web-client/client";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaText, banglaTranslator } from "../auth/test-helpers";
import { effectiveField } from "../custom-fields/test-fixtures";
import { ApiError } from "../lib/api/api-error";
import { accessFixture, type AccessOptions } from "../settings/test-fixtures";
import { emptyFieldForm, formOfField } from "./field-state";
import { fieldLabelsOf } from "./field-labels";
import { toFieldRows } from "./field-rows";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
const createCustomField = vi.fn();
const updateCustomField = vi.fn();
const archiveCustomField = vi.fn();
const updateFieldPreferences = vi.fn();
vi.mock("../lib/api/tenant-config-api", () => ({
  createCustomField: (...args: unknown[]) => createCustomField(...args),
  updateCustomField: (...args: unknown[]) => updateCustomField(...args),
  archiveCustomField: (...args: unknown[]) => archiveCustomField(...args),
  updateFieldPreferences: (...args: unknown[]) => updateFieldPreferences(...args),
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

const { FieldFormSheet } = await import("./field-form-sheet");
const { FieldDialogs } = await import("./field-dialogs");
const { FieldsPage } = await import("./fields-page");

const { t } = banglaTranslator();
const labels = fieldLabelsOf(t);
const ALL_ABILITIES = { canCreate: true, canUpdate: true, canArchive: true };

const OWN_FIELD = effectiveField({
  fieldKey: "blood_group",
  fieldType: "SELECT",
  label: { bn: "রক্তের গ্রুপ", en: "Blood group" },
  options: ["A_POS", "B_POS"],
  customFieldDefinitionId: "definition-1",
  version: 3,
  sortOrder: 20,
});
const TEMPLATE_FIELD = effectiveField({
  fieldKey: "emergency_contact",
  fieldType: "PHONE",
  scope: "INDUSTRY",
  isEditable: false,
  label: { bn: "জরুরি যোগাযোগ", en: "Emergency contact" },
  version: 0,
  sortOrder: 0,
});
const REQUIRED_TEMPLATE_FIELD = effectiveField({
  fieldKey: "nid",
  fieldType: "TEXT",
  scope: "INDUSTRY",
  isEditable: false,
  isRequired: true,
  version: 0,
});

function rowOf(field: EffectiveCustomField, abilities = ALL_ABILITIES) {
  const [row] = toFieldRows([field], { abilities, locale: "bn", t });
  if (row === undefined) throw new Error("no row");
  return row;
}

function inProvider(node: ReactNode) {
  return render(
    <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
      {node}
    </I18nProvider>,
  );
}

beforeEach(() => {
  for (const mock of [
    createCustomField,
    updateCustomField,
    archiveCustomField,
    updateFieldPreferences,
  ]) {
    mock.mockReset();
  }
  refresh.mockReset();
  requireOrgAccess.mockReset();
  fetchBusinessResource.mockReset();
});

describe("toFieldRows", () => {
  it("lets a business field be edited and archived, and a template field be renamed or hidden", () => {
    expect(rowOf(OWN_FIELD)).toMatchObject({
      canEdit: true,
      canArchive: true,
      canCustomize: false,
    });
    expect(rowOf(TEMPLATE_FIELD)).toMatchObject({
      canEdit: false,
      canCustomize: true,
      canHide: true,
    });
  });

  it("does not offer Hide for a required template field", () => {
    expect(rowOf(REQUIRED_TEMPLATE_FIELD)).toMatchObject({ canCustomize: true, canHide: false });
  });

  it("offers nothing without the key permissions", () => {
    const none = { canCreate: false, canUpdate: false, canArchive: false };

    expect(rowOf(OWN_FIELD, none)).toMatchObject({ canEdit: false, canArchive: false });
    expect(rowOf(TEMPLATE_FIELD, none)).toMatchObject({ canCustomize: false, canHide: false });
  });
});

describe("a hidden template field", () => {
  const HIDDEN_FIELD = { ...TEMPLATE_FIELD, isHidden: true as const, version: 2 };

  it("is listed as hidden and can only be shown again", () => {
    expect(rowOf(HIDDEN_FIELD)).toMatchObject({
      isHidden: true,
      canShow: true,
      canHide: false,
      canCustomize: false,
    });
  });

  it("cannot be shown again without the update permission", () => {
    const none = { canCreate: false, canUpdate: false, canArchive: false };

    expect(rowOf(HIDDEN_FIELD, none)).toMatchObject({ isHidden: true, canShow: false });
  });
});

describe("FieldFormSheet", () => {
  function renderSheet(props: { field?: ReturnType<typeof rowOf>; onClose?: () => void }) {
    const onClose = props.onClose ?? vi.fn();
    inProvider(
      <FieldFormSheet
        organizationId="org-1"
        entityType="member"
        initial={props.field ? formOfField(props.field) : emptyFieldForm(30)}
        {...(props.field ? { field: props.field } : {})}
        labels={labels}
        onClose={onClose}
      />,
    );
    return onClose;
  }

  it("creates a field on the record type with the typed key and names", async () => {
    createCustomField.mockResolvedValue({});
    const onClose = renderSheet({});

    await userEvent.type(screen.getByLabelText(new RegExp(labels.formFields.fieldKey)), "nid");
    await userEvent.type(
      screen.getByLabelText(new RegExp(labels.formFields.labelBn)),
      "পরিচয়পত্র",
    );
    await userEvent.type(
      screen.getByLabelText(new RegExp(labels.formFields.labelEn)),
      "National ID",
    );
    await userEvent.click(screen.getByRole("button", { name: labels.save }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(createCustomField.mock.calls[0]?.[0]).toBe("org-1");
    expect(createCustomField.mock.calls[0]?.[1]).toMatchObject({
      entityType: "member",
      fieldKey: "nid",
      label: { bn: "পরিচয়পত্র", en: "National ID" },
      fieldType: "TEXT",
    });
  });

  it("shows the errors of the form without calling the API", async () => {
    renderSheet({});

    await userEvent.click(screen.getByRole("button", { name: labels.save }));

    expect((await screen.findAllByText(banglaText("validation.required"))).length).toBeGreaterThan(
      0,
    );
    expect(createCustomField).not.toHaveBeenCalled();
  });

  it("locks the key and the type when editing", () => {
    renderSheet({ field: rowOf(OWN_FIELD) });

    expect(
      (screen.getByLabelText(new RegExp(labels.formFields.fieldKey)) as HTMLInputElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByLabelText(new RegExp(labels.formFields.fieldType)) as HTMLSelectElement)
        .disabled,
    ).toBe(true);
  });

  it("sends only the changed fields with the version when editing", async () => {
    updateCustomField.mockResolvedValue({});
    renderSheet({ field: rowOf(OWN_FIELD) });

    await userEvent.click(screen.getByLabelText(labels.formFields.isSensitive));
    await userEvent.click(screen.getByRole("button", { name: labels.save }));

    await waitFor(() => expect(updateCustomField).toHaveBeenCalled());
    expect(updateCustomField).toHaveBeenCalledWith("org-1", "definition-1", {
      version: 3,
      isSensitive: true,
    });
  });

  it("shows the limit message of a 422 under the form", async () => {
    createCustomField.mockRejectedValue(
      new ApiError({
        status: 422,
        code: ERROR_CODE.BUSINESS_RULE,
        messageKey: "errors.custom_field_limit",
      }),
    );
    renderSheet({});
    await userEvent.type(screen.getByLabelText(new RegExp(labels.formFields.fieldKey)), "nid");
    await userEvent.type(screen.getByLabelText(new RegExp(labels.formFields.labelBn)), "পরিচয়");
    await userEvent.type(screen.getByLabelText(new RegExp(labels.formFields.labelEn)), "ID");

    await userEvent.click(screen.getByRole("button", { name: labels.save }));

    expect(await screen.findByText(banglaText("errors.custom_field_limit"))).toBeTruthy();
  });

  it("shows a taken key as an error of the whole form and the reload hint on a 409", async () => {
    updateCustomField.mockRejectedValue(
      new ApiError({ status: 409, code: ERROR_CODE.CONFLICT, messageKey: "errors.conflict" }),
    );
    renderSheet({ field: rowOf(OWN_FIELD) });

    await userEvent.click(screen.getByLabelText(labels.formFields.isSensitive));
    await userEvent.click(screen.getByRole("button", { name: labels.save }));

    expect(await screen.findByText(labels.conflict)).toBeTruthy();
  });
});

describe("FieldDialogs", () => {
  function renderDialog(
    field: ReturnType<typeof rowOf>,
    action: "customize" | "hide" | "show" | "archive",
  ) {
    const onClose = vi.fn();
    inProvider(
      <FieldDialogs
        organizationId="org-1"
        field={field}
        action={action}
        labels={labels}
        onClose={onClose}
      />,
    );
    return onClose;
  }

  it("renames and reorders a template field through the preferences endpoint", async () => {
    updateFieldPreferences.mockResolvedValue({});
    renderDialog(rowOf(TEMPLATE_FIELD), "customize");

    await userEvent.clear(screen.getByLabelText(new RegExp(labels.formFields.labelEn)));
    await userEvent.type(
      screen.getByLabelText(new RegExp(labels.formFields.labelEn)),
      "Emergency phone",
    );
    await userEvent.click(screen.getByRole("button", { name: labels.save }));

    await waitFor(() => expect(updateFieldPreferences).toHaveBeenCalled());
    expect(updateFieldPreferences).toHaveBeenCalledWith("org-1", {
      preferences: [
        {
          entityType: "member",
          fieldKey: "emergency_contact",
          label: { bn: "জরুরি যোগাযোগ", en: "Emergency phone" },
        },
      ],
    });
  });

  it("hides a template field after the confirmation", async () => {
    updateFieldPreferences.mockResolvedValue({});
    const onClose = renderDialog(rowOf(TEMPLATE_FIELD), "hide");

    await userEvent.click(screen.getByRole("button", { name: labels.hideTitle }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updateFieldPreferences).toHaveBeenCalledWith("org-1", {
      preferences: [{ entityType: "member", fieldKey: "emergency_contact", isHidden: true }],
    });
  });

  it("shows the refusal of the API in the dialog when a required field cannot be hidden", async () => {
    updateFieldPreferences.mockRejectedValue(
      new ApiError({
        status: 422,
        code: ERROR_CODE.BUSINESS_RULE,
        messageKey: "errors.custom_field_required",
      }),
    );
    renderDialog(rowOf(TEMPLATE_FIELD), "hide");

    await userEvent.click(screen.getByRole("button", { name: labels.hideTitle }));

    expect(await screen.findByText(banglaText("errors.custom_field_required"))).toBeTruthy();
  });

  it("shows a hidden template field again with the version of its preference", async () => {
    updateFieldPreferences.mockResolvedValue({});
    const onClose = renderDialog(rowOf({ ...TEMPLATE_FIELD, isHidden: true, version: 2 }), "show");

    await userEvent.click(screen.getByRole("button", { name: labels.showTitle }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updateFieldPreferences).toHaveBeenCalledWith("org-1", {
      preferences: [
        { entityType: "member", fieldKey: "emergency_contact", isHidden: false, version: 2 },
      ],
    });
  });

  it("archives a business field with its version", async () => {
    archiveCustomField.mockResolvedValue({});
    renderDialog(rowOf(OWN_FIELD), "archive");

    await userEvent.click(screen.getByRole("button", { name: labels.archiveTitle }));

    await waitFor(() => expect(archiveCustomField).toHaveBeenCalled());
    expect(archiveCustomField).toHaveBeenCalledWith("org-1", "definition-1", { version: 3 });
  });
});

describe("FieldsPage", () => {
  const ALL_KEYS = [
    PERMISSION_KEY.CUSTOM_FIELD_DEFINITION_READ,
    PERMISSION_KEY.CUSTOM_FIELD_DEFINITION_CREATE,
    PERMISSION_KEY.CUSTOM_FIELD_DEFINITION_UPDATE,
    PERMISSION_KEY.CUSTOM_FIELD_DEFINITION_ARCHIVE,
  ];

  async function renderPage(options: AccessOptions, searchParams: Record<string, string> = {}) {
    requireOrgAccess.mockResolvedValue(
      accessFixture({ ...options, fields: { organization: [], member: [] } }),
    );
    fetchBusinessResource.mockResolvedValue({
      data: [OWN_FIELD, TEMPLATE_FIELD, REQUIRED_TEMPLATE_FIELD],
    });
    render(await FieldsPage({ orgSlug: "acme", searchParams }));
  }

  it("shows a tab for each record type and asks the API for the chosen one", async () => {
    await renderPage({ keys: ALL_KEYS }, { entity: "member" });

    expect(
      screen.getByRole("link", { name: banglaText("fields.entity.organization") }),
    ).not.toBeNull();
    expect(fetchBusinessResource.mock.calls[0]?.[0]).toContain("entityType=member");
  });

  it("shows Add, Edit and Archive for business fields and Rename and Hide for template fields", async () => {
    await renderPage({ keys: ALL_KEYS });

    expect(screen.getByRole("button", { name: banglaText("fields.add") })).not.toBeNull();
    expect(
      screen.getAllByRole("button", { name: banglaText("fields.edit") }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: banglaText("fields.customize") }).length).toBe(4);
    // Hide is offered for the optional template field only, not for the required one.
    expect(screen.getAllByRole("button", { name: banglaText("fields.hide") }).length).toBe(2);
  });

  it("shows a manager of one location the list with no buttons", async () => {
    await renderPage({
      keys: [PERMISSION_KEY.CUSTOM_FIELD_DEFINITION_READ],
      limitedKeys: ALL_KEYS,
    });

    expect(screen.queryByRole("button", { name: banglaText("fields.add") })).toBeNull();
    expect(screen.queryByRole("button", { name: banglaText("fields.edit") })).toBeNull();
    expect(screen.queryByRole("button", { name: banglaText("fields.hide") })).toBeNull();
  });

  it("shows no list to someone who may not read fields", async () => {
    await renderPage({});

    expect(screen.getByText(banglaText("state.permissionDenied"))).not.toBeNull();
  });
});

describe("FieldFormSheet roles", () => {
  const TERMS = { "contact.RELATED": { bn: "অভিভাবক", en: "Guardian" } };

  function renderContactSheet(entityType: "contact" | "member") {
    inProvider(
      <FieldFormSheet
        organizationId="org-1"
        entityType={entityType}
        initial={emptyFieldForm(30)}
        labels={fieldLabelsOf(t, { terms: TERMS, locale: "bn", roleKeys: ["CUSTOMER", "RELATED"] })}
        onClose={vi.fn()}
      />,
    );
  }

  it("offers the contact roles on a contact field, named by the business's terms, and sends the chosen ones", async () => {
    createCustomField.mockResolvedValue({});
    renderContactSheet("contact");
    const roleLabels = fieldLabelsOf(t, {
      terms: TERMS,
      locale: "bn",
      roleKeys: ["CUSTOMER", "RELATED"],
    });

    await userEvent.type(
      screen.getByLabelText(new RegExp(roleLabels.formFields.fieldKey)),
      "school_name",
    );
    await userEvent.type(screen.getByLabelText(new RegExp(roleLabels.formFields.labelBn)), "স্কুল");
    await userEvent.type(
      screen.getByLabelText(new RegExp(roleLabels.formFields.labelEn)),
      "School",
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "অভিভাবক" }));
    await userEvent.click(screen.getByRole("button", { name: roleLabels.save }));

    await waitFor(() => expect(createCustomField).toHaveBeenCalled());
    expect(createCustomField.mock.calls[0]?.[1]).toMatchObject({
      appliesToContactRoles: ["RELATED"],
    });
  });

  it("shows no roles on a field of another record type", () => {
    renderContactSheet("member");

    expect(screen.queryByRole("checkbox", { name: "অভিভাবক" })).toBeNull();
  });

  it("offers only the roles the template lists", () => {
    renderContactSheet("contact");

    expect(screen.getAllByRole("checkbox", { name: /গ্রাহক|অভিভাবক/u })).toHaveLength(2);
    expect(screen.queryByRole("checkbox", { name: banglaText("contactRole.SUPPLIER") })).toBeNull();
  });
});
