import { newId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { uuidV7Schema } from "./uuid-v7.schema.js";

describe("uuidV7Schema", () => {
  it("accepts an ID made by newId", () => {
    expect(uuidV7Schema.safeParse(newId()).success).toBe(true);
  });

  it("rejects a v4 UUID with a validation error", () => {
    const result = uuidV7Schema.safeParse("3b241101-e2bb-4255-8caf-4136c566a962");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("ids.invalid_uuid_v7");
  });
});
