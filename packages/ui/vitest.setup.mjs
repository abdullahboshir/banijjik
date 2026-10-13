import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// CI runners are slower than a developer machine, and findBy*/waitFor must not fail on load alone.
const slowMachineAsyncUtilTimeoutMs = 5_000;

configure({ asyncUtilTimeout: slowMachineAsyncUtilTimeoutMs });

// sonner reads matchMedia when it mounts; jsdom does not implement it.
globalThis.matchMedia ??= (query) => ({
  matches: false,
  media: query,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  dispatchEvent: () => false,
  onchange: null,
});

afterEach(cleanup);

// sonner captures the pointer on swipe handling; jsdom does not implement pointer capture.
globalThis.HTMLElement.prototype.setPointerCapture ??= () => undefined;
globalThis.HTMLElement.prototype.releasePointerCapture ??= () => undefined;
