import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));

vi.mock("../lib/api/api-client", () => ({ apiFetch: apiFetchMock }));

import { placeOrder } from "./order-api";

describe("placeOrder idempotency", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue({ data: {} });
  });

  it("reuses the idempotency key when the body is unchanged", async () => {
    await placeOrder("org-retry", "order-retry", { version: 1 });
    await placeOrder("org-retry", "order-retry", { version: 1 });

    expect(apiFetchMock.mock.calls[1]?.[1]?.idempotencyKey).toBe(
      apiFetchMock.mock.calls[0]?.[1]?.idempotencyKey,
    );
  });

  it("uses a new key when the version changes", async () => {
    await placeOrder("org-version", "order-version", { version: 1 });
    await placeOrder("org-version", "order-version", { version: 2 });

    expect(apiFetchMock.mock.calls[1]?.[1]?.idempotencyKey).not.toBe(
      apiFetchMock.mock.calls[0]?.[1]?.idempotencyKey,
    );
  });
});
