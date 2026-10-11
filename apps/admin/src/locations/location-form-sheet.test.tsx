// @vitest-environment jsdom
import { ERROR_CODE } from "@banijjik/contracts";
import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaText, banglaTranslator } from "../auth/test-helpers";
import { ApiError } from "../lib/api/api-error";
import { I18nProvider } from "../lib/i18n/i18n-provider";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const createLocation = vi.fn();
const updateLocation = vi.fn();
vi.mock("./location-api", () => ({
  createLocation: (...args: unknown[]) => createLocation(...args),
  updateLocation: (...args: unknown[]) => updateLocation(...args),
}));

const { LocationFormSheet } = await import("./location-form-sheet");
const { locationFormLabelsOf } = await import("./location-labels");
const { EMPTY_LOCATION_FORM } = await import("./location-state");

const { t } = banglaTranslator();
const labels = locationFormLabelsOf(t, 2);

function renderSheet(location?: { locationId: string; version: number }, onClose = vi.fn()) {
  render(
    <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
      <LocationFormSheet
        organizationId="org-1"
        initial={{ ...EMPTY_LOCATION_FORM, name: location ? "মূল দোকান" : "" }}
        {...(location ? { location } : {})}
        labels={labels}
        onClose={onClose}
      />
    </I18nProvider>,
  );
  return onClose;
}

async function typeName(name: string): Promise<void> {
  const field = screen.getByLabelText(new RegExp(labels.fields.name));
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
  createLocation.mockReset();
  updateLocation.mockReset();
  refresh.mockReset();
});

describe("LocationFormSheet", () => {
  it("asks for a name before calling the API", async () => {
    renderSheet();

    await submit();

    expect((await screen.findByRole("alert")).textContent).toBe(banglaText("validation.required"));
    expect(createLocation).not.toHaveBeenCalled();
  });

  it("creates a location with an Idempotency-Key, then closes and reloads the page", async () => {
    createLocation.mockResolvedValue({});
    const onClose = renderSheet();

    await typeName("গুদাম ১");
    await submit();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(createLocation.mock.calls[0]?.[1]).toMatchObject({
      name: "গুদাম ১",
      locationType: "STORE",
    });
    expect(typeof createLocation.mock.calls[0]?.[2]).toBe("string");
    expect(refresh).toHaveBeenCalled();
  });

  it("reuses the key when the same submit is retried after a failure", async () => {
    createLocation.mockRejectedValue(refusal(ERROR_CODE.INTERNAL, 0, "errors.network"));
    renderSheet();
    await typeName("গুদাম ১");

    await submit();
    await waitFor(() => expect(createLocation).toHaveBeenCalledTimes(1));
    await submit();
    await waitFor(() => expect(createLocation).toHaveBeenCalledTimes(2));

    expect(createLocation.mock.calls[1]?.[2]).toBe(createLocation.mock.calls[0]?.[2]);
  });

  it("uses a new key when the name changed between attempts", async () => {
    createLocation.mockRejectedValue(refusal(ERROR_CODE.INTERNAL, 0, "errors.network"));
    renderSheet();

    await typeName("গুদাম ১");
    await submit();
    await waitFor(() => expect(createLocation).toHaveBeenCalledTimes(1));
    await typeName("গুদাম ২");
    await submit();
    await waitFor(() => expect(createLocation).toHaveBeenCalledTimes(2));

    expect(createLocation.mock.calls[1]?.[2]).not.toBe(createLocation.mock.calls[0]?.[2]);
  });

  it("explains the package limit in its own words when the limit is reached", async () => {
    createLocation.mockRejectedValue(
      refusal(ERROR_CODE.LIMIT_REACHED, 422, "errors.limit_reached"),
    );
    renderSheet();

    await typeName("গুদাম ১");
    await submit();

    expect((await screen.findByRole("alert")).textContent).toBe(
      t("locations.limitReached", { limit: 2 }),
    );
  });

  it("sends the version of the location it edits and offers a reload on a 409", async () => {
    updateLocation.mockRejectedValue(refusal(ERROR_CODE.CONFLICT, 409, "errors.conflict"));
    renderSheet({ locationId: "l1", version: 5 });

    await submit();

    expect(await screen.findByText(labels.conflict)).not.toBeNull();
    expect(updateLocation.mock.calls[0]?.[1]).toBe("l1");
    expect(updateLocation.mock.calls[0]?.[2]).toMatchObject({ version: 5 });
  });
});
