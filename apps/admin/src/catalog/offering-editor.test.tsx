// @vitest-environment jsdom
import { ERROR_CODE } from "@banijjik/contracts";
import { UNIT_KEY } from "@banijjik/contracts/catalog";
import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaText, banglaTranslator, renderInBangla } from "../auth/test-helpers";
import { ApiError } from "../lib/api/api-error";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
const createOffering = vi.fn();
const updateOffering = vi.fn();
const transitionOffering = vi.fn();
vi.mock("./offering-api", () => ({
  createOffering: (...args: unknown[]) => createOffering(...args),
  updateOffering: (...args: unknown[]) => updateOffering(...args),
  transitionOffering: (...args: unknown[]) => transitionOffering(...args),
  readBranchRows: vi.fn(async () => []),
  saveBranchRow: vi.fn(),
  clearBranchRow: vi.fn(),
}));

const { default: OfferingEditor } = await import("./offering-editor");
const { editorLabelsOf } = await import("./catalog-labels");
const { newOfferingForm } = await import("./offering-form");
const { unitLabels } = await import("./catalog-words");
const { itemPickerLabelsOf } = await import("../stock/stock-labels");

const { t } = banglaTranslator();
const labels = editorLabelsOf(t);

type Props = Parameters<typeof OfferingEditor>[0];

function props(patch: Partial<Props> = {}): Props {
  return {
    organizationId: "org-1",
    orgSlug: "shop",
    initial: newOfferingForm("PRODUCT", UNIT_KEY.PIECE),
    labels,
    unitNames: unitLabels(t),
    kindWord: "পণ্য",
    status: undefined,
    currency: "BDT",
    currencySymbol: "৳",
    categories: [],
    modifierGroups: [],
    taxClasses: [],
    resourceTypes: [],
    locations: [],
    customFields: undefined,
    stockPickerLabels: itemPickerLabelsOf(t),
    canWrite: true,
    canPublish: true,
    canArchive: true,
    ...patch,
  };
}

async function typeInto(label: string, text: string): Promise<void> {
  const field = screen.getByLabelText(label);
  await userEvent.clear(field);
  await userEvent.type(field, text);
}

beforeEach(() => {
  for (const mock of [push, refresh, createOffering, updateOffering, transitionOffering]) {
    mock.mockReset();
  }
});

describe("the offering editor for a product", () => {
  it("creates a simple product with the price in minor units and opens it", async () => {
    createOffering.mockResolvedValue({ offeringId: "o-1", status: "DRAFT", version: 1 });
    renderInBangla(<OfferingEditor {...props()} />);

    await typeInto(labels["field.name"], "চাল");
    await typeInto(labels["field.price"], "12.50");
    await userEvent.click(screen.getByRole("button", { name: labels["editor.saveDraft"] }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/shop/catalog/o-1"));
    const sent = createOffering.mock.calls[0]?.[1];
    expect(sent.kind).toBe("PRODUCT");
    expect(sent.body.name).toBe("চাল");
    expect(sent.body.variants[0].price).toEqual({ amount: 1250, currency: "BDT" });
    expect(typeof sent.idempotencyKey).toBe("string");
  });

  it("publishes in the same step when asked", async () => {
    createOffering.mockResolvedValue({ offeringId: "o-1", status: "DRAFT", version: 1 });
    transitionOffering.mockResolvedValue({ offeringId: "o-1", status: "ACTIVE", version: 2 });
    renderInBangla(<OfferingEditor {...props()} />);

    await typeInto(labels["field.name"], "চাল");
    await typeInto(labels["field.price"], "10");
    await userEvent.click(screen.getByRole("button", { name: labels["editor.saveAndPublish"] }));

    await waitFor(() => expect(transitionOffering).toHaveBeenCalled());
    expect(transitionOffering.mock.calls[0]?.[1]).toMatchObject({ action: "publish", version: 1 });
  });

  it("asks for the name and the price before calling the API", async () => {
    renderInBangla(<OfferingEditor {...props()} />);

    await userEvent.click(screen.getByRole("button", { name: labels["editor.saveDraft"] }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.map((alert) => alert.textContent)).toEqual([
      banglaText("validation.required"),
      banglaText("validation.required"),
    ]);
    expect(createOffering).not.toHaveBeenCalled();
  });

  it("offers the loose rule in grams for rice sold by the kilogram", async () => {
    createOffering.mockResolvedValue({ offeringId: "o-2", status: "DRAFT", version: 1 });
    const form = { ...newOfferingForm("PRODUCT", UNIT_KEY.KG), name: "চাল" };
    renderInBangla(<OfferingEditor {...props({ initial: form })} />);

    await userEvent.click(screen.getByLabelText(labels["loose.toggle"]));
    await typeInto(labels["field.price"], "80");
    await typeInto("সবচেয়ে কম পরিমাণ (গ্রাম)", "250");
    await typeInto("যতটুকু করে বাড়বে (গ্রাম)", "250");
    await userEvent.click(screen.getByRole("button", { name: labels["editor.saveDraft"] }));

    await waitFor(() => expect(createOffering).toHaveBeenCalled());
    expect(createOffering.mock.calls[0]?.[1].body.variants[0]).toMatchObject({
      unitKey: "KG",
      quantityRule: { min: 250, step: 250 },
    });
  });
});

describe("the sections of each kind", () => {
  it("shows the duration of a service and not the weight of a product", () => {
    renderInBangla(
      <OfferingEditor {...props({ initial: newOfferingForm("SERVICE", UNIT_KEY.SESSION) })} />,
    );

    expect(screen.getByLabelText(labels["details.durationMinutes"])).toBeTruthy();
    expect(screen.queryByLabelText(labels["details.weightGrams"])).toBeNull();
  });

  it("shows the billing period and the joining fee of a plan", () => {
    renderInBangla(
      <OfferingEditor {...props({ initial: newOfferingForm("PLAN", UNIT_KEY.SESSION) })} />,
    );

    expect(screen.getByLabelText(labels["details.billingCount"])).toBeTruthy();
    expect(screen.getByLabelText(`${labels["details.admissionFee"]} (৳)`)).toBeTruthy();
  });

  it("saves a service with its resource requirement and chosen resource type", async () => {
    createOffering.mockResolvedValue({ offeringId: "o-3", status: "DRAFT", version: 1 });
    const form = { ...newOfferingForm("SERVICE", UNIT_KEY.SESSION), name: "হেয়ারকাট" };
    renderInBangla(
      <OfferingEditor
        {...props({
          initial: form,
          resourceTypes: [{ value: "STYLIST", label: "স্টাইলিস্ট" }],
        })}
      />,
    );

    await typeInto(labels["field.price"], "500");
    await userEvent.click(screen.getByLabelText("স্টাইলিস্ট"));
    await userEvent.click(screen.getByRole("button", { name: labels["editor.saveDraft"] }));

    await waitFor(() => expect(createOffering).toHaveBeenCalled());
    expect(createOffering.mock.calls[0]?.[1].body.kindDetails).toMatchObject({
      requiresResource: true,
      resourceTypeKeys: ["STYLIST"],
      bookingMode: "SLOT",
    });
  });

  it("makes a row for each combination of the options, with a duration for a service", async () => {
    renderInBangla(
      <OfferingEditor {...props({ initial: newOfferingForm("SERVICE", UNIT_KEY.SESSION) })} />,
    );

    await userEvent.click(screen.getByLabelText(labels["options.toggle"]));
    await typeInto(labels["options.name"], "চুল");
    await userEvent.type(screen.getByLabelText(labels["options.values"]), "ছোট");
    await userEvent.click(screen.getByRole("button", { name: labels["options.addValue"] }));
    await userEvent.type(screen.getByLabelText(labels["options.values"]), "লম্বা");
    await userEvent.click(screen.getByRole("button", { name: labels["options.addValue"] }));

    expect(screen.getAllByLabelText(labels["options.override.durationMinutes"])).toHaveLength(2);
    expect(screen.getAllByLabelText(labels["field.sku"])).toHaveLength(2);
  });
});

describe("a person who may only look", () => {
  it("has no save button and cannot type in the fields", () => {
    renderInBangla(<OfferingEditor {...props({ canWrite: false })} />);

    expect(screen.queryByRole("button", { name: labels["editor.saveDraft"] })).toBeNull();
    expect((screen.getByLabelText(labels["field.name"]) as HTMLInputElement).disabled).toBe(true);
  });
});

describe("when the API refuses", () => {
  async function saveWith(error: ApiError): Promise<void> {
    createOffering.mockRejectedValue(error);
    renderInBangla(<OfferingEditor {...props()} />);
    await typeInto(labels["field.name"], "চাল");
    await typeInto(labels["field.price"], "10");
    await userEvent.click(screen.getByRole("button", { name: labels["editor.saveDraft"] }));
  }

  it("links to the other offering that already uses the SKU", async () => {
    await saveWith(
      new ApiError({
        status: 409,
        code: ERROR_CODE.CONFLICT,
        messageKey: "errors.offering_sku_taken",
        details: { offeringId: "o-9" },
      }),
    );

    const link = await screen.findByRole("link", { name: labels["editor.skuTaken"] });
    expect(link.getAttribute("href")).toBe("/shop/catalog/o-9");
  });

  it("says the package is full when the limit is reached", async () => {
    await saveWith(
      new ApiError({ status: 422, code: ERROR_CODE.LIMIT_REACHED, messageKey: "errors.limit" }),
    );

    expect((await screen.findByRole("alert")).textContent).toBe(labels["editor.limit"]);
  });
});
