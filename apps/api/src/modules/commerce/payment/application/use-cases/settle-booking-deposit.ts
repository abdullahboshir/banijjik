import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import {
  settleRequestTermination,
  type SettleRequestTerminationDependencies,
  type SettleRequestTerminationInput,
} from "./settle-request-termination.js";
export type SettleBookingTerminationDependencies = SettleRequestTerminationDependencies;
export type SettleBookingTerminationInput = Omit<SettleRequestTerminationInput, "requestType">;
/** Keeps booking callers on their existing interface while sharing settlement with orders. */
export function settleBookingTermination(
  deps: SettleBookingTerminationDependencies,
  input: SettleBookingTerminationInput,
): ReturnType<typeof settleRequestTermination> {
  return settleRequestTermination(deps, { ...input, requestType: PAYMENT_REQUEST_TYPE.BOOKING });
}
