import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import {
  DefaultRequestPaymentLifecycle,
  RequestPaymentLifecycleRegistry,
  RequestReaderRegistry,
  type RequestPaymentLifecycle,
} from "../modules/commerce/payment/index.js";
import {
  buildBookingPaymentLifecycleAdapter,
  type BookingPaymentLifecycleAdapterOptions,
} from "./booking-payment-lifecycle-adapter.js";
import { buildBookingRequestReader } from "./booking-request-reader.js";
import { buildOrderRequestReader } from "./order-request-reader.js";
import { buildEnrollmentRequestReader } from "./enrollment-request-reader.js";

export function buildPaymentRequestReaders(): RequestReaderRegistry {
  const readers = new RequestReaderRegistry();
  readers.register(PAYMENT_REQUEST_TYPE.BOOKING, buildBookingRequestReader());
  readers.register(PAYMENT_REQUEST_TYPE.ORDER, buildOrderRequestReader());
  readers.register(PAYMENT_REQUEST_TYPE.ENROLLMENT, buildEnrollmentRequestReader());
  return readers;
}

export function buildPaymentRequestLifecycles(
  opts?: BookingPaymentLifecycleAdapterOptions & {
    readonly bookingLifecycle?: RequestPaymentLifecycle;
  },
): RequestPaymentLifecycleRegistry {
  const lifecycles = new RequestPaymentLifecycleRegistry();
  const defaultLifecycle = new DefaultRequestPaymentLifecycle();
  lifecycles.register(PAYMENT_REQUEST_TYPE.ORDER, defaultLifecycle);
  lifecycles.register(PAYMENT_REQUEST_TYPE.ENROLLMENT, defaultLifecycle);

  const bookingLifecycle =
    opts?.bookingLifecycle ??
    (opts?.port
      ? buildBookingPaymentLifecycleAdapter(opts.port)
      : buildBookingPaymentLifecycleAdapter(opts));

  lifecycles.register(PAYMENT_REQUEST_TYPE.BOOKING, bookingLifecycle);
  return lifecycles;
}
