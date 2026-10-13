// @vitest-environment jsdom
import { I18nProvider } from "@banijjik/web-client/client";
import { ERROR_CODE, ORGANIZATION_RULE_KEY } from "@banijjik/contracts";
import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaText, banglaTranslator } from "../auth/test-helpers";
import { ApiError } from "../lib/api/api-error";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const archiveLocation = vi.fn();
vi.mock("./location-api", () => ({
  archiveLocation: (...args: unknown[]) => archiveLocation(...args),
}));

const { LocationArchiveDialog } = await import("./location-archive-dialog");
const { locationArchiveLabelsOf } = await import("./location-labels");

const labels = locationArchiveLabelsOf(banglaTranslator().t, "মূল দোকান");

function renderDialog(onClose = vi.fn()) {
  render(
    <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
      <LocationArchiveDialog
        organizationId="org-1"
        locationId="l1"
        version={3}
        labels={labels}
        onClose={onClose}
      />
    </I18nProvider>,
  );
  return onClose;
}

function businessRule(ruleKey: string, messageKey: string): ApiError {
  return new ApiError({
    status: 422,
    code: ERROR_CODE.BUSINESS_RULE,
    messageKey,
    details: { ruleKey },
  });
}

beforeEach(() => {
  archiveLocation.mockReset();
  refresh.mockReset();
});

describe("LocationArchiveDialog", () => {
  it("archives with the version it read, then closes and reloads the page", async () => {
    archiveLocation.mockResolvedValue({});
    const onClose = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: labels.confirm }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(archiveLocation).toHaveBeenCalledWith("org-1", "l1", 3);
    expect(refresh).toHaveBeenCalled();
  });

  it("says the default location cannot be archived", async () => {
    archiveLocation.mockRejectedValue(
      businessRule(ORGANIZATION_RULE_KEY.LOCATION_IS_DEFAULT, "errors.location_is_default"),
    );
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: labels.confirm }));

    expect(await screen.findByText(banglaText("errors.location_is_default"))).not.toBeNull();
  });

  it("says how to fix a location that still has staff", async () => {
    archiveLocation.mockRejectedValue(
      businessRule(ORGANIZATION_RULE_KEY.LOCATION_IN_USE, "errors.location_in_use"),
    );
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: labels.confirm }));

    expect(await screen.findByText(banglaText("errors.location_in_use"))).not.toBeNull();
  });

  it("tells the person someone else changed the location on a 409", async () => {
    archiveLocation.mockRejectedValue(
      new ApiError({ status: 409, code: ERROR_CODE.CONFLICT, messageKey: "errors.conflict" }),
    );
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: labels.confirm }));

    expect(await screen.findByText(labels.conflict)).not.toBeNull();
  });
});
