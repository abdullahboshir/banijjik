import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// CI runners are slower than a developer machine, and findBy*/waitFor must not fail on load alone.
const slowMachineAsyncUtilTimeoutMs = 5_000;

configure({ asyncUtilTimeout: slowMachineAsyncUtilTimeoutMs });

afterEach(cleanup);
