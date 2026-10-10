// @vitest-environment jsdom
import type { MeResponse, MyOrganizationSummary } from "@banijjik/contracts";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { banglaText } from "../auth/test-helpers";

const REDIRECT_MARKER = "NEXT_REDIRECT";
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`${REDIRECT_MARKER}:${path}`);
  },
}));
vi.mock("../lib/i18n/get-translator", async () => {
  const { createTranslator } = await import("@banijjik/i18n");
  return {
    getTranslator: () => Promise.resolve(createTranslator({ locale: "bn", brandName: "Example" })),
  };
});
vi.mock("../shell/account-menu-container", () => ({ AccountMenuContainer: () => null }));

const { BusinessHome } = await import("./business-home");

const me: MeResponse = {
  userId: "u1",
  name: "রহিম",
  preferredLocale: "bn",
  isEmailVerified: false,
  isPhoneVerified: false,
  version: 1,
};

function organization(
  slug: string,
  overrides: Partial<MyOrganizationSummary> = {},
): MyOrganizationSummary {
  return {
    organizationId: `id-${slug}`,
    slug,
    name: `ব্যবসা ${slug}`,
    status: "ACTIVE",
    roleKeys: ["OWNER"],
    ...overrides,
  };
}

describe("BusinessHome", () => {
  it("shows an empty state without an action when the person has no business", async () => {
    render(await BusinessHome({ me, organizations: [] }));
    expect(screen.getByText(banglaText("orgs.empty"))).not.toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("goes straight into the only business", async () => {
    await expect(BusinessHome({ me, organizations: [organization("acme")] })).rejects.toThrow(
      `${REDIRECT_MARKER}:/acme`,
    );
  });

  it("lists several businesses as plain links with their roles and a suspended badge", async () => {
    render(
      await BusinessHome({
        me,
        organizations: [
          organization("acme"),
          organization("beta", { status: "SUSPENDED", roleKeys: ["MANAGER"] }),
        ],
      }),
    );
    const links = screen.getAllByRole("link", { name: "ব্যবসা acme" });
    expect(links[0]?.getAttribute("href")).toBe("/acme");
    expect(screen.getAllByText(banglaText("role.owner")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(banglaText("orgs.status.suspended")).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: banglaText("orgs.title") })).not.toBeNull();
  });
});
