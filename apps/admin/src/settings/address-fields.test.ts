import { describe, expect, it } from "vitest";
import { addressFromText, addressToText } from "./address-fields";

describe("address fields", () => {
  it("shows an unset address as empty text", () => {
    expect(addressToText(undefined)).toEqual({
      line1: "",
      area: "",
      thana: "",
      district: "",
      postalCode: "",
    });
  });

  it("builds an address from the filled parts only", () => {
    const address = addressFromText({
      ...addressToText(undefined),
      line1: " 12 Park Road ",
      area: " ",
    });

    expect(address).toEqual({ line1: "12 Park Road" });
  });

  it("gives no address when every part is empty", () => {
    expect(addressFromText(addressToText(undefined))).toBeUndefined();
  });
});
