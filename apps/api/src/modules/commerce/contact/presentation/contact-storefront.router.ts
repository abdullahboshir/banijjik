import { CUSTOMER_OTP_RULES } from "@banijjik/contracts/contact";
import { customerOtpSendRequestSchema, customerOtpVerifyRequestSchema } from "@banijjik/validation";
import { Router, type RequestHandler } from "express";
import { validate } from "../../../../kernel/http/index.js";
import { rateLimit, type RateLimiter } from "../../../../kernel/rate-limit/index.js";
import type { CustomerAuthController } from "./customer-auth.controller.js";

export const OTP_SEND_IP_BUCKET = "customer.otp.send.ip";
export const OTP_VERIFY_IP_BUCKET = "customer.otp.verify.ip";

export interface ContactStorefrontRouterDependencies {
  readonly auth: CustomerAuthController;
  readonly limiter: RateLimiter;
  /** 404 `storefront_not_available` unless the business turned customer sign-in on and an SMS driver exists. */
  readonly requireCustomerLogin: RequestHandler;
  /** Built by routes/storefront.ts from the customer token verifier (kernel/auth). */
  readonly authenticateCustomer: RequestHandler;
}

/**
 * The customer routes under `/storefront/orgs/{organizationId}` (14-API.md section 6). The business
 * and its tenant context are established before this router; every route needs sign-in switched on.
 */
export function buildContactStorefrontRouter(input: ContactStorefrontRouterDependencies): Router {
  const { auth, limiter, requireCustomerLogin, authenticateCustomer } = input;
  const router = Router({ mergeParams: true });
  router.use(requireCustomerLogin);
  router.post(
    "/auth/otp/send",
    rateLimit({ limiter, bucket: OTP_SEND_IP_BUCKET, ...CUSTOMER_OTP_RULES.sendsPerIp }),
    validate({ body: customerOtpSendRequestSchema }),
    auth.sendOtp,
  );
  router.post(
    "/auth/otp/verify",
    rateLimit({ limiter, bucket: OTP_VERIFY_IP_BUCKET, ...CUSTOMER_OTP_RULES.verifiesPerIp }),
    validate({ body: customerOtpVerifyRequestSchema }),
    auth.verifyOtp,
  );
  router.post("/auth/refresh", auth.refresh);
  router.post("/auth/logout", auth.logout);
  router.get("/me", authenticateCustomer, auth.me);
  return router;
}
