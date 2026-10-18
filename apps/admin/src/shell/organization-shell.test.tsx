// @vitest-environment jsdom
import type { MeResponse, MyOrganizationSummary } from "@banijjik/contracts";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { banglaText } from "../auth/test-helpers";

const NOT_FOUND_MARKER = "NEXT_NOT_FOUND";
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error(NOT_FOUND_MARKER);
  },
  usePathname: () => "/acme",
}));
vi.mock("../lib/i18n/get-translator", async () => {
  const { createTranslator, SCREEN_CATALOGS } = await import("@banijjik/i18n");
  return {
    getTranslator: () =>
      Promise.resolve(
        createTranslator({ locale: "bn", brandName: "Example", catalogs: SCREEN_CATALOGS }),
      ),
  };
});
vi.mock("./account-menu-container", () => ({ AccountMenuContainer: () => null }));
vi.mock("./shell-navigation", () => ({
  ShellNavigation: () => <nav aria-label="bottom">bottom navigation</nav>,
}));

const { OrganizationShell } = await import("./organization-shell");

const me: MeResponse = {
  userId: "u1",
  name: "রহিম",
  preferredLocale: "bn",
  isEmailVerified: false,
  isPhoneVerified: false,
  version: 1,
};

function organization(slug: string, status: "ACTIVE" | "SUSPENDED"): MyOrganizationSummary {
  return {
    organizationId: `id-${slug}`,
    slug,
    name: `ব্যবসা ${slug}`,
    status,
    roleKeys: ["OWNER"],
  };
}

describe("OrganizationShell", () => {
  it("shows the business logo in the top bar when it has one, named after the business", async () => {
    const withLogo = {
      ...organization("acme", "ACTIVE"),
      logoUrl: "/api/v1/public/files/file-1/thumb",
    };
    render(
      await OrganizationShell({
        orgSlug: "acme",
        me,
        organizations: [withLogo],
        children: <p>পৃষ্ঠা</p>,
      }),
    );

    const logo = screen.getByRole("img", {
      name: banglaText("shell.businessLogo").replace("{name}", "ব্যবসা acme"),
    });
    expect(logo.getAttribute("src")).toContain("/api/v1/public/files/file-1/thumb");
  });

  it("keeps the product name in the top bar when the business has no logo", async () => {
    render(
      await OrganizationShell({
        orgSlug: "acme",
        me,
        organizations: [organization("acme", "ACTIVE")],
        children: <p>পৃষ্ঠা</p>,
      }),
    );

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("ব্যবসা acme")).not.toBeNull();
  });

  it("shows the business name in the top bar and its page inside the shell", async () => {
    render(
      await OrganizationShell({
        orgSlug: "acme",
        me,
        organizations: [organization("acme", "ACTIVE"), organization("beta", "ACTIVE")],
        children: <p>পৃষ্ঠার বিষয়বস্তু</p>,
      }),
    );
    expect(screen.getByText("ব্যবসা acme")).not.toBeNull();
    expect(screen.getByText("পৃষ্ঠার বিষয়বস্তু")).not.toBeNull();
    expect(screen.getByText("bottom navigation")).not.toBeNull();
  });

  it("answers not found for a slug that is not one of the person's businesses", async () => {
    await expect(
      OrganizationShell({
        orgSlug: "someone-elses",
        me,
        organizations: [organization("acme", "ACTIVE")],
        children: <p>secret</p>,
      }),
    ).rejects.toThrow(NOT_FOUND_MARKER);
  });

  it("shows the suspended explanation instead of the page and keeps the top bar", async () => {
    render(
      await OrganizationShell({
        orgSlug: "acme",
        me,
        organizations: [organization("acme", "SUSPENDED")],
        children: <p>পৃষ্ঠার বিষয়বস্তু</p>,
      }),
    );
    expect(
      screen.getByText(banglaText("errors.org_suspended").replace("{brand}", "Example")),
    ).not.toBeNull();
    expect(screen.queryByText("পৃষ্ঠার বিষয়বস্তু")).toBeNull();
    expect(screen.getByText("ব্যবসা acme")).not.toBeNull();
    expect(screen.queryByText("bottom navigation")).toBeNull();
  });
});
