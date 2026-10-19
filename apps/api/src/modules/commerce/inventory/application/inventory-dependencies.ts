import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type { ApprovalVerifier } from "../../../core/iam/index.js";
import type { StockLedgerService } from "./stock-ledger.service.js";
import type { CatalogOfferingReader } from "./ports/catalog-offering-reader.js";
import type {
  InventoryCurrencyReader,
  InventoryEventPublisher,
  InventoryLocationLookup,
  InventorySettingsReader,
  TransferNumberSequence,
  UnitOfWork,
} from "./ports/inventory-context-ports.js";
import type { InventoryItemRepository } from "./ports/inventory-item-repository.js";
import type {
  InventoryLevelRepository,
  StockMovementRepository,
  StockReservationRepository,
} from "./ports/stock-repository.js";

export interface InventoryDependencies {
  readonly items: InventoryItemRepository;
  readonly movements: StockMovementRepository;
  readonly levels: InventoryLevelRepository;
  readonly reservations: StockReservationRepository;
  readonly unitOfWork: UnitOfWork;
  readonly events: InventoryEventPublisher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly settings: InventorySettingsReader;
  readonly currency: InventoryCurrencyReader;
  readonly locations: InventoryLocationLookup;
  readonly sequences: TransferNumberSequence;
  readonly offerings: CatalogOfferingReader;
  readonly approvals: ApprovalVerifier;
  readonly stockLedger: StockLedgerService;
}
