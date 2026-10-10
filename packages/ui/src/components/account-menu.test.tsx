import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  AccountMenu,
  type AccountMenuOrganization,
  type AccountMenuProps,
} from "./account-menu.js";

const organizations: AccountMenuOrganization[] = [
  {
    organizationId: "o1",
    name: "রহিম ট্রেডার্স অ্যান্ড সন্স",
    href: "/rahim-traders",
    isCurrent: true,
  },
  { organizationId: "o2", name: "করিমা ফ্যাশন হাউস", href: "/karima-fashion", isCurrent: false },
];

function renderMenu(overrides: Partial<AccountMenuProps> = {}): AccountMenuProps {
  const props: AccountMenuProps = {
    open: true,
    onOpenChange: vi.fn(),
    title: "অ্যাকাউন্ট",
    closeLabel: "বন্ধ করুন",
    userName: "রহিম উদ্দিন আহমেদ",
    organizationsHeading: "আপনার ব্যবসা",
    organizations,
    languageHeading: "ভাষা",
    languages: [
      { localeKey: "bn", label: "বাংলা", isCurrent: true },
      { localeKey: "en", label: "English", isCurrent: false },
    ],
    onLocaleChange: vi.fn(),
    signOutLabel: "সাইন আউট",
    onSignOut: vi.fn(),
    ...overrides,
  };
  render(<AccountMenu {...props} />);
  return props;
}

describe("AccountMenu", () => {
  it("lists the businesses as plain links and marks the current one", () => {
    renderMenu();
    const current = screen.getByRole("link", { name: "রহিম ট্রেডার্স অ্যান্ড সন্স" });
    const other = screen.getByRole("link", { name: "করিমা ফ্যাশন হাউস" });
    expect(current.getAttribute("aria-current")).toBe("true");
    expect(other.getAttribute("aria-current")).toBeNull();
    expect(other.getAttribute("href")).toBe("/karima-fashion");
  });

  it("shows the user name and the headings it was given", () => {
    renderMenu();
    expect(screen.getByText("রহিম উদ্দিন আহমেদ")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "আপনার ব্যবসা" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "ভাষা" })).not.toBeNull();
  });

  it("calls onLocaleChange with the key of the chosen language", async () => {
    const props = renderMenu();
    await userEvent.click(screen.getByRole("button", { name: "English" }));
    expect(props.onLocaleChange).toHaveBeenCalledWith("en");
    expect(screen.getByRole("button", { name: "বাংলা" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("calls onSignOut when the sign out button is pressed", async () => {
    const props = renderMenu();
    await userEvent.click(screen.getByRole("button", { name: "সাইন আউট" }));
    expect(props.onSignOut).toHaveBeenCalledTimes(1);
  });

  it("keeps every action reachable when a Bangla business name is very long", () => {
    renderMenu({
      organizations: [
        {
          organizationId: "o3",
          name: "আন্তর্জাতিক পাইকারি ও খুচরা বিক্রয় কেন্দ্র লিমিটেড এবং সহযোগী প্রতিষ্ঠানসমূহ",
          href: "/long",
          isCurrent: false,
        },
      ],
    });
    expect(screen.getByRole("button", { name: "সাইন আউট" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "English" })).not.toBeNull();
  });
});
