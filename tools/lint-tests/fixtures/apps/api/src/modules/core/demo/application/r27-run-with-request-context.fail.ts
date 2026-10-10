import { runWithRequestContext } from "../../../../kernel/context/index.js";

export function pretendToBeAnotherRequest(): number {
  return runWithRequestContext({ requestId: "forged" }, () => 1);
}
