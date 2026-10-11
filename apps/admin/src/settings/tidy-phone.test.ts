import { describe, expect, it } from "vitest";
import { tidyPhone } from "./tidy-phone";

describe("tidyPhone", () => {
  it("shows a valid number the way people write it", () => {
    expect(tidyPhone("+8801712345678")).toBe("01712-345678");
  });

  it("accepts the local form with a dash or spaces", () => {
    expect(tidyPhone("01712 345678")).toBe("01712-345678");
  });

  it("leaves text that is not a phone number as typed", () => {
    expect(tidyPhone("017")).toBe("017");
  });
});
