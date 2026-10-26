// @vitest-environment jsdom
import { ERROR_CODE } from "@banijjik/contracts";
import type { PosDeviceCreatedResponse } from "@banijjik/contracts/pos";
import { POS_DEVICE_STATUS } from "@banijjik/contracts/pos";
import { I18nProvider } from "@banijjik/web-client/client";
import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { useState } from "react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaText, banglaTranslator } from "../auth/test-helpers";
import { ApiError } from "../lib/api/api-error";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const createPosDevice = vi.fn();
vi.mock("./pos-devices-api", () => ({
  createPosDevice: (...args: unknown[]) => createPosDevice(...args),
}));

const { PosDeviceAddSheet } = await import("./pos-device-add-sheet");
const { deviceAddLabelsOf } = await import("./pos-devices-labels");

const LOCATION_ID = "0190a6a0-0000-7000-8000-000000000001";
const PAIRING_CODE = "48213907";

const { t } = banglaTranslator();
const labels = deviceAddLabelsOf(t, 2);

const CREATED: PosDeviceCreatedResponse = {
  posDeviceId: "0190a6a0-0000-7000-8000-0000000000aa",
  locationId: LOCATION_ID,
  name: "কাউন্টার ১",
  status: POS_DEVICE_STATUS.ACTIVE,
  pairedAt: null,
  lastSeenAt: null,
  isAwaitingPairing: true,
  version: 1,
  createdAt: "2026-10-26T04:00:00.000Z",
  pairingCode: PAIRING_CODE,
  pairingExpiresAt: "2026-10-26T04:10:00.000Z",
};

/** A parent that unmounts the sheet when it closes, as the add button does. */
function SheetHost(): ReactElement {
  const [isOpen, setIsOpen] = useState(true);
  if (!isOpen) return <p>closed</p>;
  return (
    <PosDeviceAddSheet
      organizationId="org-1"
      locations={[{ locationId: LOCATION_ID, name: "মূল শাখা" }]}
      defaultLocationId={LOCATION_ID}
      labels={labels}
      onClose={() => setIsOpen(false)}
    />
  );
}

function renderSheet(onClose = vi.fn()): ReturnType<typeof vi.fn> {
  render(
    <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
      <PosDeviceAddSheet
        organizationId="org-1"
        locations={[{ locationId: LOCATION_ID, name: "মূল শাখা" }]}
        defaultLocationId={LOCATION_ID}
        labels={labels}
        onClose={onClose}
      />
    </I18nProvider>,
  );
  return onClose;
}

async function typeName(name: string): Promise<void> {
  const field = screen.getByLabelText(new RegExp(labels.name));
  await userEvent.clear(field);
  await userEvent.type(field, name);
}

async function submit(): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: labels.submit }));
}

function refusal(code: ApiError["code"], status: number, messageKey: string): ApiError {
  return new ApiError({ status, code, messageKey });
}

beforeEach(() => {
  createPosDevice.mockReset();
  refresh.mockReset();
});

describe("PosDeviceAddSheet", () => {
  it("asks for a name before calling the API", async () => {
    renderSheet();

    await submit();

    expect((await screen.findByRole("alert")).textContent).toBe(banglaText("validation.required"));
    expect(createPosDevice).not.toHaveBeenCalled();
  });

  it("shows the one-time code, then closes and reloads the list", async () => {
    createPosDevice.mockResolvedValue(CREATED);
    const onClose = renderSheet();

    await typeName("কাউন্টার ১");
    await submit();

    expect((await screen.findByText(PAIRING_CODE)).id).toBe("pos-device-code");
    await userEvent.click(screen.getByRole("button", { name: labels.done }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("drops the code from the screen once the parent closes the sheet", async () => {
    createPosDevice.mockResolvedValue(CREATED);
    render(
      <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
        <SheetHost />
      </I18nProvider>,
    );

    await typeName("কাউন্টার ১");
    await submit();
    await screen.findByText(PAIRING_CODE);
    await userEvent.click(screen.getByRole("button", { name: labels.done }));

    expect(screen.queryByText(PAIRING_CODE)).toBeNull();
    expect(screen.getByText("closed")).toBeTruthy();
  });

  it("does not reload the list when the sheet closes before any device was added", async () => {
    const onClose = renderSheet();

    await userEvent.click(screen.getByRole("button", { name: labels.close }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows the package limit when the API refuses the add at the limit", async () => {
    createPosDevice.mockRejectedValue(
      refusal(ERROR_CODE.LIMIT_REACHED, 422, "errors.limit_reached"),
    );
    renderSheet();

    await typeName("কাউন্টার ২");
    await submit();

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(labels.limitReached));
    expect(screen.queryByText(PAIRING_CODE)).toBeNull();
  });
});
