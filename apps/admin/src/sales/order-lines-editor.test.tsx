// @vitest-environment jsdom
import { OFFERING_KIND } from "@banijjik/contracts";
import {
  OFFERING_STATUS,
  UNIT_KEY,
  VARIANT_STATUS,
  type ModifierGroupResponse,
  type OfferingResponse,
  type QuantityRule,
  type VariantResponse,
} from "@banijjik/contracts/catalog";
import { formatMoney } from "@banijjik/ui";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { banglaTranslator, renderInBangla } from "../auth/test-helpers";
import { orderLabelsOf } from "./order-labels";
import { emptyOrderLine, type OrderLineDraft } from "./order-lines";
import { OrderLinesEditor } from "./order-lines-editor";

vi.mock("./lazy-product-picker", () => ({
  LazyProductPicker: () => null,
}));

const labels = orderLabelsOf(banglaTranslator().t).line;
const TIMESTAMP = "2026-10-24T00:00:00.000Z";

function variantWith(quantityRule: QuantityRule | null): VariantResponse {
  return {
    variantId: "variant-1",
    name: "১ কেজি",
    optionValues: {},
    price: { amount: 12000, currency: "BDT" },
    compareAtPrice: null,
    sku: null,
    barcode: null,
    unitKey: UNIT_KEY.KG,
    quantityRule,
    stockComponents: [],
    overrides: {},
    status: VARIANT_STATUS.ACTIVE,
  };
}

function offeringWith(quantityRule: QuantityRule | null): OfferingResponse {
  return {
    offeringId: "offering-1",
    kind: OFFERING_KIND.PRODUCT,
    name: "চাল",
    slug: "rice",
    status: OFFERING_STATUS.ACTIVE,
    description: null,
    categories: [],
    modifierGroups: [],
    images: [],
    variants: [variantWith(quantityRule)],
    kindDetails: { requiresShipping: false },
    taxClassKey: null,
    synonyms: [],
    customFields: {},
    version: 1,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

function lineWith(quantityRule: QuantityRule | null, quantity: string): OrderLineDraft {
  return {
    ...emptyOrderLine("draft-1"),
    offering: offeringWith(quantityRule),
    quantity,
  };
}

/** `Intl` money text carries bidi marks and narrow spaces; the visible words are what matters here. */
function squashInvisible(text: string): string {
  return text.replace(/[\s\u200e\u200f\u2066-\u2069\u202a-\u202e]/gu, "");
}

function renderEditor(lines: readonly OrderLineDraft[]): void {
  renderInBangla(
    <OrderLinesEditor
      organizationId="org-1"
      lines={lines}
      modifierGroups={[]}
      unitLabels={{ [UNIT_KEY.KG]: "কেজি", [UNIT_KEY.GRAM]: "গ্রাম" }}
      currency="BDT"
      locale="bn"
      labels={labels}
      disabled={false}
      onChange={() => {}}
    />,
  );
}

describe("OrderLinesEditor", () => {
  it("states the loose rule in the words of the unit the shop types in", () => {
    renderEditor([lineWith({ min: 500, step: 100 }, "৫০০")]);

    expect(screen.getByText("ন্যূনতম 500 গ্রাম, 100 গ্রাম করে বাড়ান।")).toBeDefined();
  });

  it("shows the quantity only for a variant without a loose rule", () => {
    renderEditor([lineWith(null, "২")]);

    expect(screen.getByText("২ কেজি")).toBeDefined();
  });

  it("marks a quantity the loose rule refuses", () => {
    renderEditor([lineWith({ min: 500, step: 100 }, "৫৫০")]);

    expect(screen.getByText(labels.quantityInvalid)).toBeDefined();
  });

  it("shows the unit price and the line total from the variant and modifier prices", () => {
    const line: OrderLineDraft = {
      ...lineWith(null, "2"),
      offering: {
        ...offeringWith(null),
        modifierGroups: [{ referenceId: "group-1", name: "অ্যাড-অন" }],
      },
      modifierOptionIds: ["modifier-1"],
    };
    renderInBangla(
      <OrderLinesEditor
        organizationId="org-1"
        lines={[line]}
        modifierGroups={[modifierGroup()]}
        unitLabels={{ [UNIT_KEY.KG]: "কেজি" }}
        currency="BDT"
        locale="bn"
        labels={labels}
        disabled={false}
        onChange={() => {}}
      />,
    );

    const text = squashInvisible(document.body.textContent ?? "");
    expect(text).toContain(
      squashInvisible(formatMoney({ amount: 12500, currency: "BDT" }, { locale: "bn" })),
    );
    expect(text).toContain(
      squashInvisible(formatMoney({ amount: 25000, currency: "BDT" }, { locale: "bn" })),
    );
  });

  it("asks for a required add-on until one is chosen", () => {
    const line: OrderLineDraft = {
      ...lineWith(null, "1"),
      offering: {
        ...offeringWith(null),
        modifierGroups: [{ referenceId: "group-1", name: "অ্যাড-অন" }],
      },
    };
    renderInBangla(
      <OrderLinesEditor
        organizationId="org-1"
        lines={[line]}
        modifierGroups={[modifierGroup()]}
        unitLabels={{ [UNIT_KEY.KG]: "কেজি" }}
        currency="BDT"
        locale="bn"
        labels={labels}
        disabled={false}
        onChange={() => {}}
      />,
    );

    expect(screen.getByText(labels.required)).toBeDefined();
  });

  it("keeps the only line and offers remove once a second line exists", () => {
    renderEditor([lineWith(null, "1")]);
    expect(screen.queryByRole("button", { name: labels.remove })).toBeNull();
  });

  it("offers remove for every line when there is more than one", () => {
    renderEditor([lineWith(null, "1"), lineWith(null, "2")]);
    expect(screen.getAllByRole("button", { name: labels.remove })).toHaveLength(2);
  });
});

function modifierGroup(): ModifierGroupResponse {
  return {
    modifierGroupId: "group-1",
    name: "অ্যাড-অন",
    selection: "SINGLE",
    isRequired: true,
    minSelect: 1,
    maxSelect: 1,
    options: [
      {
        modifierOptionId: "modifier-1",
        name: "বড়",
        priceDelta: { amount: 500, currency: "BDT" },
        status: "ACTIVE",
      },
    ],
    status: "ACTIVE",
    version: 1,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  } as ModifierGroupResponse;
}
