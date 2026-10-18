import { asId, type CustomerAccountId } from "@banijjik/ids";
import { getRequestContext } from "../context/index.js";
import { unauthenticated } from "../http/index.js";

/** The signed-in customer account, put into the request context by authenticateCustomer(). */
export function requireCurrentCustomerAccountId(): CustomerAccountId {
  const { customerAccountId } = getRequestContext();
  if (customerAccountId === undefined) throw unauthenticated();
  return asId<CustomerAccountId>(customerAccountId);
}
