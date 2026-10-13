import { describe, expect, it } from "vitest";
import { env } from "./env";

describe("env", () => {
  it("is validated from process.env when the module loads", () => {
    expect(env.NEXT_PUBLIC_API_BASE_URL).toBe("http://localhost:4000");
  });
});
