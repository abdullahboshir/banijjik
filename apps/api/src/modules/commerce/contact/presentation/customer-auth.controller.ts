import { asId, type OrganizationId } from "@banijjik/ids";
import { STOREFRONT_REFRESH_COOKIE_NAME } from "@banijjik/contracts/contact";
import type {
  CustomerAccountEraseBody,
  CustomerOtpSendBody,
  CustomerOtpVerifyBody,
} from "@banijjik/validation";
import type { Request, RequestHandler } from "express";
import { requireCurrentCustomerAccountId } from "../../../../kernel/auth/index.js";
import { readCookie, sendData } from "../../../../kernel/http/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type {
  GetStorefrontMeUseCase,
  LogoutCustomerUseCase,
  RefreshCustomerSessionUseCase,
} from "../application/use-cases/customer-session.use-cases.js";
import type { EraseOwnCustomerAccountUseCase } from "../application/use-cases/erase-own-customer-account.use-case.js";
import type { ExportCustomerDataUseCase } from "../application/use-cases/export-customer-data.use-case.js";
import type { SendCustomerEraseOtpUseCase } from "../application/use-cases/send-customer-erase-otp.use-case.js";
import type { SendCustomerOtpUseCase } from "../application/use-cases/send-customer-otp.use-case.js";
import type { VerifyCustomerOtpUseCase } from "../application/use-cases/verify-customer-otp.use-case.js";
import type { CustomerCookies } from "./customer-cookies.js";

const HTTP_ACCEPTED = 202;
const HTTP_NO_CONTENT = 204;

export interface CustomerAuthControllerDependencies {
  readonly sendOtp: SendCustomerOtpUseCase;
  readonly verifyOtp: VerifyCustomerOtpUseCase;
  readonly refresh: RefreshCustomerSessionUseCase;
  readonly logout: LogoutCustomerUseCase;
  readonly me: GetStorefrontMeUseCase;
  readonly sendEraseOtp: SendCustomerEraseOtpUseCase;
  readonly eraseAccount: EraseOwnCustomerAccountUseCase;
  readonly dataExport: ExportCustomerDataUseCase;
  readonly cookies: CustomerCookies;
  readonly clock: Clock;
}

function readOrganizationId(request: Request): OrganizationId {
  // The storefront pipeline already checked the path parameter and the business behind it.
  return asId<OrganizationId>(String(request.params["organizationId"]));
}

/** The customer sign-in endpoints of `/storefront/orgs/{organizationId}` (14-API.md section 6). */
export class CustomerAuthController {
  constructor(private readonly dependencies: CustomerAuthControllerDependencies) {}

  readonly sendOtp: RequestHandler = async (request, response) => {
    const body: CustomerOtpSendBody = request.body;
    const result = await this.dependencies.sendOtp.execute({
      organizationId: readOrganizationId(request),
      phoneE164: body.phone,
    });
    sendData(response, result, { status: HTTP_ACCEPTED });
  };

  readonly verifyOtp: RequestHandler = async (request, response) => {
    const body: CustomerOtpVerifyBody = request.body;
    const result = await this.dependencies.verifyOtp.execute({
      organizationId: readOrganizationId(request),
      phoneE164: body.phone,
      code: body.code,
      userAgent: request.get("user-agent"),
    });
    this.dependencies.cookies.set(response, result.session, this.dependencies.clock.now());
    sendData(response, await this.dependencies.me.execute(result.customerAccountId));
  };

  readonly refresh: RequestHandler = async (request, response) => {
    const issued = await this.dependencies.refresh.execute({
      organizationId: readOrganizationId(request),
      refreshToken: readCookie(request, STOREFRONT_REFRESH_COOKIE_NAME),
    });
    this.dependencies.cookies.set(response, issued, this.dependencies.clock.now());
    response.status(HTTP_NO_CONTENT).end();
  };

  readonly logout: RequestHandler = async (request, response) => {
    await this.dependencies.logout.execute(readCookie(request, STOREFRONT_REFRESH_COOKIE_NAME));
    this.dependencies.cookies.clear(response);
    response.status(HTTP_NO_CONTENT).end();
  };

  readonly me: RequestHandler = async (_request, response) => {
    sendData(response, await this.dependencies.me.execute(requireCurrentCustomerAccountId()));
  };

  readonly sendEraseOtp: RequestHandler = async (request, response) => {
    const result = await this.dependencies.sendEraseOtp.execute({
      organizationId: readOrganizationId(request),
      customerAccountId: requireCurrentCustomerAccountId(),
    });
    sendData(response, result, { status: 200 });
  };

  readonly eraseAccount: RequestHandler = async (request, response) => {
    const body: CustomerAccountEraseBody = request.body;
    const result = await this.dependencies.eraseAccount.execute({
      organizationId: readOrganizationId(request),
      customerAccountId: requireCurrentCustomerAccountId(),
      challengeId: body.challengeId,
      code: body.code,
    });
    this.dependencies.cookies.clear(response);
    sendData(response, result, { status: 200 });
  };

  readonly dataExport: RequestHandler = async (request, response) => {
    const result = await this.dependencies.dataExport.execute({
      organizationId: readOrganizationId(request),
      customerAccountId: requireCurrentCustomerAccountId(),
    });
    sendData(response, result, { status: 200 });
  };
}
