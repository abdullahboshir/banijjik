import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type {
  OrderRepository,
  OrderPaymentPort,
  SalesApprovalVerifier,
  SalesSettingsReader,
  SalesStockLedger,
  SalesTimeZoneReader,
  SalesUnitOfWork,
} from "./ports/sales-ports.js";
import type {
  SalesRefundApprovalRule,
  SalesRefundPermissionReader,
  SalesReturnMemberReader,
  SalesReturnRepository,
} from "./ports/sales-return-ports.js";

/** Everything a return use case needs. Routes build the adapters; tests build fakes or real Mongo. */
export interface SalesReturnDependencies {
  readonly orders: OrderRepository;
  readonly returns: SalesReturnRepository;
  readonly unitOfWork: SalesUnitOfWork;
  readonly events: {
    publish(
      type: string,
      payload: unknown,
      options: { readonly orderingKey: string },
    ): Promise<void>;
  };
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly timeZone: SalesTimeZoneReader;
  readonly settings: SalesSettingsReader;
  readonly stock: SalesStockLedger;
  readonly approvals: SalesApprovalVerifier;
  readonly payments: OrderPaymentPort;
  readonly refundApproval: SalesRefundApprovalRule;
  readonly refundPermission: SalesRefundPermissionReader;
  readonly members: SalesReturnMemberReader;
}
