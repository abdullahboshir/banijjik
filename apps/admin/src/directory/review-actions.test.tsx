// @vitest-environment jsdom
import { ERROR_CODE } from "@banijjik/contracts";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api/api-error";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const approveListing = vi.fn();
const rejectListing = vi.fn();
const hideListing = vi.fn();
const unhideListing = vi.fn();
vi.mock("./directory-api", () => ({
  approveListing: (...args: unknown[]) => approveListing(...args),
  rejectListing: (...args: unknown[]) => rejectListing(...args),
  hideListing: (...args: unknown[]) => hideListing(...args),
  unhideListing: (...args: unknown[]) => unhideListing(...args),
}));

const { ReviewActions } = await import("./review-actions");

const LABELS = {
  approve: "Approve",
  approveConfirmTitle: "Approve?",
  approveConfirmDescription: "Will publish",
  reject: "Reject",
  hide: "Hide",
  unhide: "Unhide",
  confirm: "Confirm",
  cancel: "Cancel",
  close: "Close",
  versionConflict: "This listing changed; reload",
  checklistTitle: "Checklist",
  checklistHelp: "Help",
  noneApply: "N/A",
  rejectForm: {
    title: "Reject form",
    reasons: "Reasons",
    finalMark: "Final",
    note: "Note",
    submit: "Submit reject",
    cancel: "Cancel",
    reasonRequired: "Need reason",
  },
};

const REASONS = [{ reasonKey: "unclear", label: { bn: "অস্পষ্ট", en: "Unclear" }, isFinal: false }];

beforeEach(() => {
  for (const mock of [approveListing, rejectListing, hideListing, unhideListing, push, refresh]) {
    mock.mockReset();
  }
});

describe("ReviewActions", () => {
  it("shows review buttons for STAFF and hides hide when not allowed", () => {
    render(
      <ReviewActions
        organizationId="org-1"
        listingId="listing-1"
        version={2}
        status="SUBMITTED"
        canReview={true}
        canHide={false}
        reasons={REASONS}
        locale="en"
        labels={LABELS}
        queueHref="/acme/directory/queue"
      />,
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reject" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Hide" })).toBeNull();
  });

  it("approves through the API and returns to the queue", async () => {
    approveListing.mockResolvedValue({});
    render(
      <ReviewActions
        organizationId="org-1"
        listingId="listing-1"
        version={2}
        status="SUBMITTED"
        canReview={true}
        canHide={false}
        reasons={REASONS}
        locale="en"
        labels={LABELS}
        queueHref="/acme/directory/queue"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(approveListing).toHaveBeenCalledWith("org-1", "listing-1", { version: 2 }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/acme/directory/queue"));
  });

  it("rejects with a reason and leaves the queue", async () => {
    rejectListing.mockResolvedValue({});
    render(
      <ReviewActions
        organizationId="org-1"
        listingId="listing-1"
        version={2}
        status="SUBMITTED"
        canReview={true}
        canHide={false}
        reasons={REASONS}
        locale="en"
        labels={LABELS}
        queueHref="/acme/directory/queue"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    const reasonBoxes = screen.getAllByLabelText(/Unclear/u);
    await userEvent.click(reasonBoxes[reasonBoxes.length - 1] as HTMLElement);
    await userEvent.click(screen.getByRole("button", { name: "Submit reject" }));
    await waitFor(() =>
      expect(rejectListing).toHaveBeenCalledWith("org-1", "listing-1", {
        reasonKeys: ["unclear"],
        version: 2,
      }),
    );
  });

  it("shows the version conflict message", async () => {
    approveListing.mockRejectedValue(
      new ApiError({
        status: 409,
        code: ERROR_CODE.CONFLICT,
        messageKey: "errors.directory_listing_conflict",
      }),
    );
    render(
      <ReviewActions
        organizationId="org-1"
        listingId="listing-1"
        version={2}
        status="SUBMITTED"
        canReview={true}
        canHide={false}
        reasons={REASONS}
        locale="en"
        labels={LABELS}
        queueHref="/acme/directory/queue"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findByText("This listing changed; reload")).toBeTruthy();
  });
});
