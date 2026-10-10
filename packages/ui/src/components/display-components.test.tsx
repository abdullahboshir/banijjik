import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "./app-shell.js";
import { EmptyState } from "./empty-state.js";
import { FormField, TextInput, formFieldMessageId } from "./form.js";
import { MoneyText } from "./money-text.js";
import { PageHeader } from "./page-header.js";
import { Skeleton } from "./skeleton.js";
import { StatusBadge } from "./status-badge.js";
import { TopBar } from "./top-bar.js";

describe("StatusBadge", () => {
  it("uses the tone from the status table", () => {
    render(<StatusBadge requestType="ORDER" status="DELIVERED" label="ডেলিভারি সম্পন্ন হয়েছে" />);
    expect(screen.getByText("ডেলিভারি সম্পন্ন হয়েছে").getAttribute("data-tone")).toBe("success");
  });
});

describe("MoneyText", () => {
  it("renders the formatted amount with Bengali digits when asked", () => {
    render(
      <MoneyText money={{ amount: 125000, currency: "BDT" }} locale="bn" digitScript="BENGALI" />,
    );
    expect(screen.getByText("৳ ১,২৫০")).not.toBeNull();
  });
});

describe("FormField", () => {
  it("links the label to the input and shows the error as an alert", () => {
    render(
      <FormField
        label="গ্রাহকের পূর্ণ নাম"
        htmlFor="contact-name"
        error="নাম দেওয়া আবশ্যক"
        required
      >
        <TextInput
          id="contact-name"
          aria-invalid
          aria-describedby={formFieldMessageId("contact-name", "error")}
        />
      </FormField>,
    );
    expect(screen.getByLabelText(/গ্রাহকের পূর্ণ নাম/)).not.toBeNull();
    expect(screen.getByRole("alert").textContent).toBe("নাম দেওয়া আবশ্যক");
  });

  it("keeps input text at 16px so iOS does not zoom", () => {
    render(<TextInput aria-label="ফোন" />);
    expect(screen.getByLabelText("ফোন").className).toContain("text-body");
  });
});

describe("page pieces", () => {
  it("renders the empty state message and its single action", () => {
    render(<EmptyState message="এখনো কোনো পণ্য নেই" action={<a href="/new">পণ্য যোগ করুন</a>} />);
    expect(screen.getByText("এখনো কোনো পণ্য নেই")).not.toBeNull();
    expect(screen.getByRole("link", { name: "পণ্য যোগ করুন" })).not.toBeNull();
  });

  it("renders the requested number of skeleton lines, hidden from screen readers", () => {
    const { container } = render(<Skeleton variant="row" count={3} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.getAttribute("aria-hidden")).toBe("true");
    expect(wrapper.children).toHaveLength(3);
  });

  it("renders the page title as the main heading with actions and filters", () => {
    render(
      <PageHeader title="অর্ডারসমূহ" actions={<button>নতুন</button>} filters={<p>ফিল্টার</p>} />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "অর্ডারসমূহ" })).not.toBeNull();
    expect(screen.getByText("ফিল্টার")).not.toBeNull();
  });

  it("places every shell slot on the page", () => {
    render(
      <AppShell
        topBar={<TopBar logo={<span>লোগো</span>} organizationName="রহমান জেনারেল স্টোর" />}
        sidebar={<p>সাইডবার</p>}
        bottomNav={<p>নিচের মেনু</p>}
      >
        <p>পাতার বিষয়বস্তু</p>
      </AppShell>,
    );
    expect(screen.getByRole("banner").textContent).toContain("রহমান জেনারেল স্টোর");
    expect(screen.getByRole("main").textContent).toBe("পাতার বিষয়বস্তু");
    expect(screen.getByText("সাইডবার")).not.toBeNull();
    expect(screen.getByText("নিচের মেনু")).not.toBeNull();
  });
});
