// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { banglaText, banglaTranslator } from "../auth/test-helpers";
import { SubscriptionBanners } from "./subscription-banners";

const { t } = banglaTranslator();

describe("SubscriptionBanners", () => {
  it("shows nothing when there is nothing to say", () => {
    const { container } = render(<SubscriptionBanners states={[]} t={t} />);
    expect(container.textContent).toBe("");
  });

  it("names the days left, tomorrow and today in Bangla", () => {
    const { rerender } = render(
      <SubscriptionBanners states={[{ kind: "trial", daysLeft: 5 }]} t={t} />,
    );
    expect(screen.getByRole("status").textContent).toBe(
      banglaText("banner.trial.days").replace("{days}", "5"),
    );
    rerender(<SubscriptionBanners states={[{ kind: "trial", daysLeft: 1 }]} t={t} />);
    expect(screen.getByRole("status").textContent).toBe(banglaText("banner.trial.oneDay"));
    rerender(<SubscriptionBanners states={[{ kind: "trial", daysLeft: 0 }]} t={t} />);
    expect(screen.getByRole("status").textContent).toBe(banglaText("banner.trial.today"));
  });

  it("explains past due and read-only without a billing link", () => {
    render(<SubscriptionBanners states={[{ kind: "pastDue" }, { kind: "readOnly" }]} t={t} />);
    expect(screen.getByText(banglaText("banner.pastDue"))).not.toBeNull();
    expect(screen.getByText(banglaText("banner.readOnly"))).not.toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
