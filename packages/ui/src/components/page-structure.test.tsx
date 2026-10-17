import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardFrame } from "./dashboard-frame.js";
import { EmptyState } from "./empty-state.js";
import { PageLayout } from "./page-layout.js";
import { PageSection } from "./page-section.js";
import { Skeleton } from "./skeleton.js";
import { TopicCard } from "./topic-card.js";

describe("PageLayout", () => {
  it("renders the title as the only h1 with its help line, action and filters", () => {
    render(
      <PageLayout
        title="কর্মী"
        subtitle="যারা আপনার ব্যবসায় কাজ করেন"
        actions={<button type="button">নতুন কর্মী</button>}
        filters={<p>ফিল্টার</p>}
      >
        <p>বিষয়বস্তু</p>
      </PageLayout>,
    );
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]?.textContent).toBe("কর্মী");
    expect(screen.getByText("যারা আপনার ব্যবসায় কাজ করেন")).not.toBeNull();
    expect(screen.getByRole("button", { name: "নতুন কর্মী" })).not.toBeNull();
    expect(screen.getByText("ফিল্টার")).not.toBeNull();
    expect(screen.getByText("বিষয়বস্তু")).not.toBeNull();
  });

  it("omits the help line and the action row when none is given", () => {
    render(<PageLayout title="কর্মী" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(document.querySelector("header p")).toBeNull();
  });
});

describe("PageSection", () => {
  it("is a named region with an h2 below the page's h1", () => {
    render(
      <PageLayout title="প্রোফাইল">
        <PageSection
          title="ব্যবসার তথ্য"
          help="নাম ও যোগাযোগের তথ্য"
          action={<button type="button">সম্পাদনা</button>}
        >
          <p>ভিতরের লেখা</p>
        </PageSection>
      </PageLayout>,
    );
    const levels = screen.getAllByRole("heading").map((heading) => heading.tagName);
    expect(levels).toEqual(["H1", "H2"]);
    const region = screen.getByRole("region", { name: "ব্যবসার তথ্য" });
    expect(within(region).getByText("নাম ও যোগাযোগের তথ্য")).not.toBeNull();
    expect(within(region).getByRole("button", { name: "সম্পাদনা" })).not.toBeNull();
    expect(within(region).getByText("ভিতরের লেখা")).not.toBeNull();
  });

  it("gives two sections on one page different heading ids", () => {
    render(
      <>
        <PageSection title="এক">a</PageSection>
        <PageSection title="দুই">b</PageSection>
      </>,
    );
    const ids = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe("EmptyState illustrations", () => {
  it.each(["none", "noResults", "noPermission"] as const)(
    "draws a hidden line art for the %s kind next to the message",
    (kind) => {
      render(<EmptyState kind={kind} message="কিছু নেই" />);
      expect(screen.getByText("কিছু নেই")).not.toBeNull();
      const art = document.querySelector("svg");
      expect(art?.getAttribute("aria-hidden")).toBe("true");
      expect(document.querySelectorAll("img, image")).toHaveLength(0);
    },
  );

  it("draws a different picture for each kind", () => {
    const drawings = (["none", "noResults", "noPermission"] as const).map((kind) => {
      const { container, unmount } = render(<EmptyState kind={kind} message="x" />);
      const markup = container.querySelector("svg")?.innerHTML;
      unmount();
      return markup;
    });
    expect(new Set(drawings).size).toBe(3);
  });
});

describe("TopicCard", () => {
  it("shows the topic, its one-line help and a link to each page", () => {
    render(
      <TopicCard
        title="ব্যবসা"
        description="লোগো, ঠিকানা, ভাষা"
        iconKey="store"
        links={[
          { href: "/acme/settings/profile", label: "প্রোফাইল" },
          { href: "/acme/settings/general", label: "সাধারণ সেটিংস" },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "ব্যবসা" })).not.toBeNull();
    expect(screen.getByText("লোগো, ঠিকানা, ভাষা")).not.toBeNull();
    expect(screen.getByRole("link", { name: "প্রোফাইল" }).getAttribute("href")).toBe(
      "/acme/settings/profile",
    );
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});

describe("DashboardFrame", () => {
  it("shows the greeting and the cards area", () => {
    render(
      <DashboardFrame greeting="শুভ সকাল">
        <p>আজকের কার্ড</p>
      </DashboardFrame>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "শুভ সকাল" })).not.toBeNull();
    expect(screen.getByText("আজকের কার্ড")).not.toBeNull();
  });

  it("draws no empty cards area while 3.10 has no cards yet", () => {
    const { container } = render(<DashboardFrame greeting="শুভ সকাল" />);
    expect(container.querySelector(".grid")).toBeNull();
  });
});

describe("Skeleton page variants", () => {
  it("renders a title and a section block hidden from screen readers", () => {
    const { container } = render(
      <>
        <Skeleton variant="title" />
        <Skeleton variant="section" count={2} />
      </>,
    );
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
  });
});
