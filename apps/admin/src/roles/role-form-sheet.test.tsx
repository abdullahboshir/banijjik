import { I18nProvider } from "@banijjik/web-client/client";
// @vitest-environment jsdom
import { ERROR_CODE, PERMISSION_KEY } from "@banijjik/contracts";
import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaText, banglaTranslator } from "../auth/test-helpers";
import { ApiError } from "../lib/api/api-error";
import { allDefinitions } from "../settings/test-fixtures";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const createRole = vi.fn();
const updateRole = vi.fn();
vi.mock("./role-api", () => ({
  createRole: (...args: unknown[]) => createRole(...args),
  updateRole: (...args: unknown[]) => updateRole(...args),
}));

const { RoleFormSheet } = await import("./role-form-sheet");
const { roleFormGroupsOf, roleFormLabelsOf } = await import("./role-labels");
const { groupPermissions } = await import("./permission-groups");

const translator = banglaTranslator();
const { t } = translator;
const labels = roleFormLabelsOf(t);
const SENSITIVE = PERMISSION_KEY.ORGANIZATION_OWNERSHIP_TRANSFER;
const PROFILE_UPDATE = PERMISSION_KEY.ORGANIZATION_PROFILE_UPDATE;
const MEMBER_READ = PERMISSION_KEY.ORGANIZATION_MEMBER_READ;

function groupsFor(heldKeys: string[], selectedKeys: string[] = []) {
  return roleFormGroupsOf(
    groupPermissions({
      definitions: allDefinitions([SENSITIVE]),
      heldKeys: new Set(heldKeys),
      selectedKeys: new Set(selectedKeys),
      mode: "offer",
      t,
      hasText: translator.has,
    }),
    t,
  );
}

interface SheetOptions {
  heldKeys?: string[];
  selectedKeys?: string[];
  role?: { roleId: string; version: number };
  preservedKeys?: string[];
}

function renderSheet(options: SheetOptions = {}, onClose = vi.fn()) {
  const held = options.heldKeys ?? [PROFILE_UPDATE, MEMBER_READ, SENSITIVE];
  render(
    <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
      <RoleFormSheet
        organizationId="org-1"
        initialName={options.role ? "বিক্রয় সহকারী" : ""}
        groups={groupsFor(held, options.selectedKeys)}
        {...(options.role ? { role: options.role } : {})}
        {...(options.preservedKeys ? { preservedKeys: options.preservedKeys } : {})}
        labels={labels}
        onClose={onClose}
      />
    </I18nProvider>,
  );
  return onClose;
}

function permissionBox(permissionKey: string): HTMLInputElement {
  return screen.getByLabelText(banglaText(`permission.${permissionKey}`)) as HTMLInputElement;
}

async function submit(): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: labels.submit }));
}

beforeEach(() => {
  createRole.mockReset();
  updateRole.mockReset();
  refresh.mockReset();
});

describe("RoleFormSheet", () => {
  it("groups permissions by module with the sensitive ones in their own block", () => {
    renderSheet();

    const organization = screen.getByRole("group", {
      name: banglaText("roles.module.organization"),
    });
    const sensitiveBlock = within(organization).getByText(labels.sensitiveGroup).parentElement;
    expect(
      within(organization).getByLabelText(banglaText(`permission.${PROFILE_UPDATE}`)),
    ).not.toBeNull();
    expect(
      within(sensitiveBlock as HTMLElement).getByLabelText(banglaText(`permission.${SENSITIVE}`)),
    ).not.toBeNull();
  });

  it("offers only the permissions the caller holds", () => {
    renderSheet({ heldKeys: [PROFILE_UPDATE] });

    expect(screen.queryByLabelText(banglaText(`permission.${MEMBER_READ}`))).toBeNull();
    expect(screen.getByLabelText(banglaText(`permission.${PROFILE_UPDATE}`))).not.toBeNull();
    expect(screen.getByText(labels.heldHint)).not.toBeNull();
  });

  it("selects every ordinary permission of a group with one box, and not the sensitive ones", async () => {
    renderSheet();

    await userEvent.click(
      screen.getByLabelText(
        t("roles.form.selectAll", { group: banglaText("roles.module.organization") }),
      ),
    );

    expect(permissionBox(PROFILE_UPDATE).checked).toBe(true);
    expect(permissionBox(MEMBER_READ).checked).toBe(true);
    expect(permissionBox(SENSITIVE).checked).toBe(false);
  });

  it("creates a role with the name and the chosen permissions", async () => {
    createRole.mockResolvedValue({});
    const onClose = renderSheet();

    await userEvent.type(screen.getByLabelText(new RegExp(labels.name)), "বিক্রয় সহকারী");
    await userEvent.click(permissionBox(PROFILE_UPDATE));
    await userEvent.click(permissionBox(MEMBER_READ));
    await submit();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(createRole).toHaveBeenCalledWith("org-1", {
      name: "বিক্রয় সহকারী",
      permissionKeys: [PROFILE_UPDATE, MEMBER_READ],
    });
  });

  it("asks for a name before calling the API", async () => {
    renderSheet();

    await submit();

    expect((await screen.findByRole("alert")).textContent).toBe(banglaText("validation.required"));
    expect(createRole).not.toHaveBeenCalled();
  });

  it("keeps a permission the role has but the caller lacks, locked and still sent", async () => {
    updateRole.mockResolvedValue({});
    renderSheet({
      heldKeys: [PROFILE_UPDATE],
      selectedKeys: [SENSITIVE],
      role: { roleId: "r1", version: 6 },
    });

    expect(permissionBox(SENSITIVE).disabled).toBe(true);
    expect(permissionBox(SENSITIVE).checked).toBe(true);
    await submit();

    await waitFor(() => expect(updateRole).toHaveBeenCalled());
    expect(updateRole).toHaveBeenCalledWith("org-1", "r1", {
      name: "বিক্রয় সহকারী",
      permissionKeys: [SENSITIVE],
      version: 6,
    });
  });

  it("sends back permissions of a module that is off instead of dropping them", async () => {
    updateRole.mockResolvedValue({});
    renderSheet({ role: { roleId: "r1", version: 2 }, preservedKeys: ["audit.log.read"] });

    await submit();

    await waitFor(() => expect(updateRole).toHaveBeenCalled());
    expect(updateRole.mock.calls[0]?.[2]).toMatchObject({ permissionKeys: ["audit.log.read"] });
  });

  it("puts a taken role name on the name field", async () => {
    createRole.mockRejectedValue(
      new ApiError({
        status: 409,
        code: ERROR_CODE.DUPLICATE,
        messageKey: "errors.role_name_taken",
      }),
    );
    renderSheet();

    await userEvent.type(screen.getByLabelText(new RegExp(labels.name)), "বিক্রয় সহকারী");
    await submit();

    expect((await screen.findByRole("alert")).textContent).toBe(
      banglaText("errors.role_name_taken"),
    );
  });

  it("offers a reload when someone else changed the role", async () => {
    updateRole.mockRejectedValue(
      new ApiError({ status: 409, code: ERROR_CODE.CONFLICT, messageKey: "errors.conflict" }),
    );
    renderSheet({ role: { roleId: "r1", version: 6 } });

    await submit();

    expect(await screen.findByText(labels.conflict)).not.toBeNull();
  });
});
