import type { RequestHandler } from "express";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import {
  asId,
  type ContactId,
  type LocationId,
  type OrganizationId,
  type PaymentId,
  type UserId,
} from "@banijjik/ids";
import type { AdjustStoreCreditUseCase } from "../application/use-cases/adjust-store-credit.use-case.js";
import type {
  GetPaymentUseCase,
  ListPaymentsUseCase,
} from "../application/use-cases/get-payment.use-case.js";
import type { GetDuesUseCase } from "../application/use-cases/get-dues.use-case.js";
import type { ListStoreCreditEntriesUseCase } from "../application/use-cases/list-store-credit-entries.use-case.js";
import type { ReceivePaymentUseCase } from "../application/use-cases/receive-payment.use-case.js";
import type { RefundPaymentUseCase } from "../application/use-cases/refund-payment.use-case.js";
import type { ReversePaymentUseCase } from "../application/use-cases/reverse-payment.use-case.js";

const HTTP_CREATED = 201;

export class PaymentController {
  constructor(
    private readonly useCases: {
      readonly receivePayment: ReceivePaymentUseCase;
      readonly refundPayment: RefundPaymentUseCase;
      readonly reversePayment: ReversePaymentUseCase;
      readonly getPayment: GetPaymentUseCase;
      readonly listPayments: ListPaymentsUseCase;
      readonly getDues: GetDuesUseCase;
      readonly adjustStoreCredit: AdjustStoreCreditUseCase;
      readonly listStoreCredit: ListStoreCreditEntriesUseCase;
      readonly isManagerOrOwner: (
        userId: UserId,
        organizationId: OrganizationId,
      ) => Promise<boolean>;
      readonly getMemberId: (userId: UserId, organizationId: OrganizationId) => Promise<string>;
    },
  ) {}

  readonly receive: RequestHandler = async (request, response) => {
    const body = response.locals["validated"].body;
    const { organizationId, actorUserId } = readTenantCaller();
    const memberId = await this.useCases.getMemberId(actorUserId, organizationId);

    const payment = await this.useCases.receivePayment.execute({
      organizationId,
      locationId: asId<LocationId>(body.locationId),
      method: body.method,
      amount: body.amount,
      externalReference: body.externalReference,
      allocations: body.allocations ?? [],
      contactId: body.contactId,
      receivedByMemberId: memberId,
      actorUserId,
      businessDate: body.businessDate,
      note: body.note,
    });

    sendData(response, payment, { status: HTTP_CREATED });
  };

  readonly refund: RequestHandler = async (request, response) => {
    const body = response.locals["validated"].body;
    const { organizationId, actorUserId } = readTenantCaller();
    const memberId = await this.useCases.getMemberId(actorUserId, organizationId);
    const isManagerOrOwner = await this.useCases.isManagerOrOwner(actorUserId, organizationId);

    const payment = await this.useCases.refundPayment.execute({
      organizationId,
      locationId: asId<LocationId>(body.locationId),
      method: body.method,
      amount: body.amount,
      externalReference: body.externalReference,
      allocations: body.allocations,
      contactId: body.contactId,
      receivedByMemberId: memberId,
      actorUserId,
      isManagerOrOwner,
      approvalToken: body.approvalToken,
      businessDate: body.businessDate,
      note: body.note,
    });

    sendData(response, payment, { status: HTTP_CREATED });
  };

  readonly reverse: RequestHandler = async (request, response) => {
    const body = response.locals["validated"].body;
    const params = response.locals["validated"].params;
    const { organizationId, actorUserId } = readTenantCaller();
    const memberId = await this.useCases.getMemberId(actorUserId, organizationId);

    const payment = await this.useCases.reversePayment.execute({
      organizationId,
      paymentId: asId<PaymentId>(params.paymentId),
      approvalToken: body.approvalToken,
      receivedByMemberId: memberId,
      actorUserId,
      note: body.note,
    });

    sendData(response, payment, { status: HTTP_CREATED });
  };

  readonly get: RequestHandler = async (request, response) => {
    const params = response.locals["validated"].params;
    const { organizationId } = readTenantCaller();

    const payment = await this.useCases.getPayment.execute({
      organizationId,
      paymentId: asId<PaymentId>(params.paymentId),
    });

    sendData(response, payment);
  };

  readonly list: RequestHandler = async (request, response) => {
    const query = response.locals["validated"].query;
    const { organizationId } = readTenantCaller();

    const result = await this.useCases.listPayments.execute({
      organizationId,
      locationId: query.locationId ? asId<LocationId>(query.locationId) : undefined,
      contactId: query.contactId,
      method: query.method,
      direction: query.direction,
      from: query.from,
      to: query.to,
      page: query.page,
      limit: query.limit,
    });

    sendData(response, result.items, {
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
      },
    });
  };

  readonly dues: RequestHandler = async (request, response) => {
    const query = response.locals["validated"].query;
    const { organizationId } = readTenantCaller();

    const result = await this.useCases.getDues.execute({
      organizationId,
      locationId: query.locationId ? asId<LocationId>(query.locationId) : undefined,
      contactId: query.contactId,
      requestType: query.requestType,
      page: query.page,
      limit: query.limit,
    });

    sendData(response, result.items, {
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
      },
    });
  };

  readonly adjustCredit: RequestHandler = async (request, response) => {
    const body = response.locals["validated"].body;
    const { organizationId, actorUserId } = readTenantCaller();

    const entry = await this.useCases.adjustStoreCredit.execute({
      organizationId,
      contactId: asId<ContactId>(body.contactId),
      direction: body.direction,
      amount: body.amount,
      reason: body.reason,
      approvalToken: body.approvalToken,
      actorUserId,
    });

    sendData(response, entry, { status: HTTP_CREATED });
  };

  readonly listCredit: RequestHandler = async (request, response) => {
    const query = response.locals["validated"].query;
    const { organizationId } = readTenantCaller();

    if (!query.contactId) {
      sendData(response, [], { meta: { page: 1, limit: query.limit, total: 0 } });
      return;
    }

    const result = await this.useCases.listStoreCredit.execute({
      organizationId,
      contactId: asId<ContactId>(query.contactId),
      page: query.page,
      limit: query.limit,
    });

    sendData(response, result.items, {
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        balanceMinor: result.balanceMinor,
      },
    });
  };
}
