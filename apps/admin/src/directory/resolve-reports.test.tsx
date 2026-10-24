// @vitest-environment jsdom
import { DIRECTORY_API_MESSAGE_KEYS } from "@banijjik/contracts/directory";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api/api-error";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const resolveListingReports = vi.fn();
vi.mock("./directory-api", () => ({
  resolveListingReports: (...args: unknown[]) => resolveListingReports(...args),
}));

const toastError = vi.fn();
vi.mock("./report-stale-toast", () => ({
  showStaleReportsToast: (...args: unknown[]) => toastError(...args),
}));

const { ResolveReports } = await import("./resolve-reports");

const LABELS = {
  open: "Resolve reports",
  title: "Resolve these reports",
  outcome: "Outcome",
  note: "Note",
  submit: "Resolve",
  cancel: "Cancel",
  close: "Close",
  stale: "These reports changed",
  failure: "Could not resolve",
  outcomes: {
    DISMISSED: "Dismiss",
    WARNED: "Warn",
    LISTING_HIDDEN: "Hide the listing",
    ACCOUNT_BLOCKED: "Block the account",
  },
};

function renderResolve(overrides: { canHide?: boolean; canBlockAccounts?: boolean } = {}): void {
  render(
    <ResolveReports
      organizationId="org-1"
      listingId="listing-1"
      reportIds={["report-1", "report-2"]}
      canHide={overrides.canHide ?? false}
      canBlockAccounts={overrides.canBlockAccounts ?? false}
      queueHref="/acme/directory/reports"
      labels={LABELS}
    />,
  );
}

async function openSheet(): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: "Resolve reports" }));
}

beforeEach(() => {
  for (const mock of [push, refresh, resolveListingReports, toastError]) mock.mockReset();
});

describe("ResolveReports", () => {
  it("offers hide and block outcomes only with their permissions", async () => {
    renderResolve();
    await openSheet();
    expect(screen.getByLabelText("Dismiss")).toBeTruthy();
    expect(screen.getByLabelText("Warn")).toBeTruthy();
    expect(screen.queryByLabelText("Hide the listing")).toBeNull();
    expect(screen.queryByLabelText("Block the account")).toBeNull();
  });

  it("shows the hide and block outcomes when both permissions are held", async () => {
    renderResolve({ canHide: true, canBlockAccounts: true });
    await openSheet();
    expect(screen.getByLabelText("Hide the listing")).toBeTruthy();
    expect(screen.getByLabelText("Block the account")).toBeTruthy();
  });

  it("sends exactly the report ids on screen and returns to the queue", async () => {
    resolveListingReports.mockResolvedValue([]);
    renderResolve({ canHide: true });
    await openSheet();
    await userEvent.click(screen.getByLabelText("Hide the listing"));
    await userEvent.type(screen.getByLabelText("Note"), "  clear violation ");
    await userEvent.click(screen.getByRole("button", { name: "Resolve" }));
    await waitFor(() =>
      expect(resolveListingReports).toHaveBeenCalledWith("org-1", "listing-1", {
        reportIds: ["report-1", "report-2"],
        outcome: "LISTING_HIDDEN",
        note: "clear violation",
      }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/acme/directory/reports"));
  });

  it("reloads the list with a toast when the reports are stale", async () => {
    resolveListingReports.mockRejectedValue(
      new ApiError({
        status: 409,
        code: "CONFLICT",
        messageKey: DIRECTORY_API_MESSAGE_KEYS.reportStale,
      }),
    );
    renderResolve();
    await openSheet();
    await userEvent.click(screen.getByRole("button", { name: "Resolve" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("These reports changed"));
    expect(refresh).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a failure message for other errors and stays on the sheet", async () => {
    resolveListingReports.mockRejectedValue(
      new ApiError({ status: 500, code: "INTERNAL", messageKey: "errors.internal" }),
    );
    renderResolve();
    await openSheet();
    await userEvent.click(screen.getByRole("button", { name: "Resolve" }));
    expect(await screen.findByText("Could not resolve")).toBeTruthy();
    expect(toastError).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
