// @vitest-environment jsdom
import { PERMISSION_KEY, type RoleSummary } from "@banijjik/contracts";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaText, banglaTranslator } from "../auth/test-helpers";
import { accessFixture, type AccessOptions } from "../settings/test-fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
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

const { RolesPage } = await import("./roles-page");
const { RoleDetailPage } = await import("./role-detail-page");

const SENSITIVE = PERMISSION_KEY.ORGANIZATION_OWNERSHIP_TRANSFER;
const ROLE_KEYS = [
  PERMISSION_KEY.IAM_ROLE_READ,
  PERMISSION_KEY.IAM_ROLE_CREATE,
  PERMISSION_KEY.IAM_ROLE_UPDATE,
  PERMISSION_KEY.IAM_ROLE_ARCHIVE,
];

function role(overrides: Partial<RoleSummary> & { roleId: string }): RoleSummary {
  return {
    roleKey: "CUSTOM",
    isSystem: false,
    status: "ACTIVE",
    permissionKeys: [],
    memberCount: 0,
    version: 1,
    ...overrides,
  };
}

const SYSTEM_ROLE = role({
  roleId: "r-manager",
  roleKey: "MANAGER",
  isSystem: true,
  nameKey: "role.manager",
  permissionKeys: [PERMISSION_KEY.ORGANIZATION_PROFILE_UPDATE, SENSITIVE],
  memberCount: 2,
});
const CUSTOM_ROLE = role({
  roleId: "r-custom",
  name: "বিক্রয় সহকারী",
  permissionKeys: [PERMISSION_KEY.ORGANIZATION_MEMBER_READ],
  memberCount: 1,
});

async function renderList(options: AccessOptions, roles: RoleSummary[]): Promise<void> {
  requireOrgAccess.mockResolvedValue(accessFixture({ sensitiveKeys: [SENSITIVE], ...options }));
  fetchBusinessResource.mockResolvedValue({ data: roles });
  render(await RolesPage({ orgSlug: "acme" }));
}

async function renderDetail(options: AccessOptions, roleId: string): Promise<void> {
  requireOrgAccess.mockResolvedValue(accessFixture({ sensitiveKeys: [SENSITIVE], ...options }));
  fetchBusinessResource.mockResolvedValue({ data: [CUSTOM_ROLE, SYSTEM_ROLE] });
  render(await RoleDetailPage({ orgSlug: "acme", roleId }));
}

beforeEach(() => {
  requireOrgAccess.mockReset();
});

describe("RolesPage", () => {
  it("lists the system roles first with the system mark, then the custom ones, with member counts", async () => {
    await renderList({ keys: ROLE_KEYS }, [CUSTOM_ROLE, SYSTEM_ROLE]);

    const names = screen
      .getAllByRole("cell")
      .map((cell) => cell.textContent)
      .filter((text) => text?.includes("ম্যানেজার") || text?.includes("বিক্রয় সহকারী"));
    expect(names[0]).toContain(banglaText("role.manager"));
    expect(names[0]).toContain(banglaText("roles.system"));
    expect(names[1]).toBe("বিক্রয় সহকারী");
    expect(screen.getAllByText(banglaText("roles.status.active")).length).toBeGreaterThan(0);
  });

  it("offers a new role only with the create permission", async () => {
    await renderList({ keys: [PERMISSION_KEY.IAM_ROLE_READ] }, [SYSTEM_ROLE]);

    expect(screen.queryByRole("button", { name: banglaText("roles.add") })).toBeNull();
  });

  it("offers a new role with the create permission", async () => {
    await renderList({ keys: ROLE_KEYS }, [SYSTEM_ROLE]);

    expect(screen.getByRole("button", { name: banglaText("roles.add") })).not.toBeNull();
  });

  it("shows no list to someone who may not read roles", async () => {
    await renderList({}, [SYSTEM_ROLE]);

    expect(screen.getByText(banglaText("state.permissionDenied"))).not.toBeNull();
  });
});

describe("RoleDetailPage", () => {
  it("shows a system role read-only, with the reason and no actions", async () => {
    await renderDetail({ keys: ROLE_KEYS }, SYSTEM_ROLE.roleId);

    expect(screen.getByText(banglaText("roles.detail.systemNote"))).not.toBeNull();
    expect(screen.queryByRole("button", { name: banglaText("roles.edit") })).toBeNull();
    expect(screen.queryByRole("button", { name: banglaText("roles.archive") })).toBeNull();
  });

  it("groups the permissions by module and marks the sensitive one from the definitions", async () => {
    await renderDetail({ keys: ROLE_KEYS }, SYSTEM_ROLE.roleId);

    expect(screen.getByText(banglaText("roles.module.organization"))).not.toBeNull();
    expect(screen.getByText(banglaText("roles.sensitive.group"))).not.toBeNull();
    expect(
      screen.getByText(banglaText(`permission.${SENSITIVE}`)).parentElement?.textContent,
    ).toContain(banglaText("roles.sensitive.mark"));
  });

  it("offers edit and archive for a custom role with the permissions", async () => {
    await renderDetail({ keys: ROLE_KEYS }, CUSTOM_ROLE.roleId);

    expect(screen.getByRole("button", { name: banglaText("roles.edit") })).not.toBeNull();
    expect(screen.getByRole("button", { name: banglaText("roles.archive") })).not.toBeNull();
  });

  it("offers no actions for a custom role in read-only mode", async () => {
    await renderDetail({ keys: ROLE_KEYS, canWrite: false }, CUSTOM_ROLE.roleId);

    expect(screen.queryByRole("button", { name: banglaText("roles.edit") })).toBeNull();
  });

  it("answers not found for a role of another business", async () => {
    await expect(renderDetail({ keys: ROLE_KEYS }, "r-elsewhere")).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });
});
