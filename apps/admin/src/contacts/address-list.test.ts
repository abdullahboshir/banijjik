import type { ContactAddress } from "@banijjik/contracts/contact";
import { describe, expect, it } from "vitest";
import {
  addressErrors,
  addressesWithDefault,
  addressesWithEdit,
  addressesWithNew,
  EMPTY_ADDRESS_FORM,
} from "./address-list";

const HOME: ContactAddress = { addressId: "a-1", label: "Home", line1: "12 Road", isDefault: true };
const SHOP: ContactAddress = {
  addressId: "a-2",
  label: "Shop",
  line1: "5 Market",
  isDefault: false,
};

const form = { ...EMPTY_ADDRESS_FORM, label: "Office", line1: " 9 Lane ", district: "Dhaka" };

describe("address lists", () => {
  it("makes the first address the default even when it is not marked", () => {
    const [only] = addressesWithNew([], form);

    expect(only).toMatchObject({
      label: "Office",
      line1: "9 Lane",
      district: "Dhaka",
      isDefault: true,
    });
  });

  it("keeps the old default unless the new address is marked", () => {
    const kept = addressesWithNew([HOME], form);
    const moved = addressesWithNew([HOME], { ...form, isDefault: true });

    expect(kept.map((address) => address.isDefault)).toEqual([true, false]);
    expect(moved.map((address) => address.isDefault)).toEqual([false, true]);
  });

  it("edits one address by id and keeps ids of the others", () => {
    const list = addressesWithEdit([HOME, SHOP], "a-2", {
      ...form,
      label: "Shop 2",
      isDefault: true,
    });

    expect(list.map((address) => [address.addressId, address.label, address.isDefault])).toEqual([
      ["a-1", "Home", false],
      ["a-2", "Shop 2", true],
    ]);
  });

  it("moves the default mark to the chosen address", () => {
    const list = addressesWithDefault([HOME, SHOP], "a-2");

    expect(list.map((address) => address.isDefault)).toEqual([false, true]);
  });

  it("requires a label and a first line", () => {
    expect(addressErrors(EMPTY_ADDRESS_FORM)).toEqual({
      label: "validation.required",
      line1: "validation.required",
    });
    expect(addressErrors(form)).toEqual({});
  });
});
