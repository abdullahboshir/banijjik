import type { LimitGuard } from "../../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type {
  OrderCounter,
  OrderEventPublisher,
  OrderRepository,
  PaymentSummaryReader,
  SalesApprovalVerifier,
  SalesCatalogReader,
  SalesContactReader,
  SalesCurrencyReader,
  SalesOwnerReader,
  SalesQuoter,
  SalesSettingsReader,
  SalesStockLedger,
  SalesTimeZoneReader,
  SalesUnitCostReader,
  SalesUnitOfWork,
} from "./ports/sales-ports.js";

/** Everything an order use case needs; routes build the adapters, tests build fakes. */
export interface SalesDependencies {
  readonly orders: OrderRepository;
  readonly counter: OrderCounter;
  readonly unitOfWork: SalesUnitOfWork;
  readonly events: OrderEventPublisher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly quoter: SalesQuoter;
  readonly catalog: SalesCatalogReader;
  readonly contacts: SalesContactReader;
  readonly timeZone: SalesTimeZoneReader;
  readonly currency: SalesCurrencyReader;
  readonly settings: SalesSettingsReader;
  readonly stock: SalesStockLedger;
  readonly approvals: SalesApprovalVerifier;
  readonly payments: PaymentSummaryReader;
  readonly limits: LimitGuard;
  readonly owner: SalesOwnerReader;
  readonly unitCosts: SalesUnitCostReader;
}

/**
 * What the two hourly jobs run: they discard a DRAFT and cancel a PLACED order, so they never
 * quote, approve, count a limit or take a margin snapshot.
 */
export type SalesJobDependencies = Pick<
  SalesDependencies,
  "orders" | "unitOfWork" | "events" | "audit" | "clock" | "settings" | "stock" | "payments"
>;
