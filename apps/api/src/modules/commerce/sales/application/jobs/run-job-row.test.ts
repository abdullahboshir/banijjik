import { ERROR_CODE } from "@banijjik/contracts";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../../../../kernel/http/index.js";
import { runJobRow } from "./run-job-row.js";

const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn() }));
vi.mock("../../../../../kernel/logger/index.js", () => ({ getLogger: () => logger }));

describe("sales job row", () => {
  it("a failing sales job row is logged at error", async () => {
    await runJobRow("order-1", async () => {
      throw new Error("boom");
    });
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("skips a row a version conflict moved on without logging", async () => {
    logger.error.mockClear();
    await runJobRow("order-2", async () => {
      throw new AppError({ code: ERROR_CODE.CONFLICT });
    });
    expect(logger.error).not.toHaveBeenCalled();
  });
});
