import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import { RequestReaderRegistry } from "../modules/commerce/payment/index.js";
import { buildBookingRequestReader } from "./booking-request-reader.js";
import { buildOrderRequestReader } from "./order-request-reader.js";
export function buildPaymentRequestReaders(): RequestReaderRegistry {
  const readers = new RequestReaderRegistry();
  readers.register(PAYMENT_REQUEST_TYPE.BOOKING, buildBookingRequestReader());
  readers.register(PAYMENT_REQUEST_TYPE.ORDER, buildOrderRequestReader());
  return readers;
}
