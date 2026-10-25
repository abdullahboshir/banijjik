import type { RequestHandler, Router } from "express";
import type { PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import type {
  PosCaller,
  PosCatalogReader,
  PosCurrencyReader,
  PosLocationReader,
  PosPaymentPort,
  PosRateLimit,
  PosSettingsReader,
  PosSoldOrdersReader,
} from "./application/ports/pos-ports.js";
import type { InstantSaleService } from "../sales/index.js";
import { GetPosCatalogSnapshotUseCase } from "./application/use-cases/catalog-snapshot.use-case.js";
import { CreatePosSaleUseCase } from "./application/use-cases/create-pos-sale.use-case.js";
import {
  CreatePosDeviceUseCase,
  ListPosDevicesUseCase,
  PairPosDeviceUseCase,
  RevokePosDeviceUseCase,
} from "./application/use-cases/device.use-cases.js";
import {
  ClosePosSessionUseCase,
  GetPosZReportUseCase,
  OpenPosSessionUseCase,
} from "./application/use-cases/session.use-cases.js";
import { MongoPosDeviceRepository } from "./infrastructure/mongo-pos-device.repository.js";
import { MongoPosSessionRepository } from "./infrastructure/mongo-pos-session.repository.js";
import { PosController } from "./presentation/pos.controller.js";
import { buildPosTenantRouter } from "./presentation/pos-tenant.router.js";
import { requirePosDevice } from "./presentation/require-pos-device.middleware.js";

export { posManifest } from "./module.manifest.js";
export { registerPosModels } from "./infrastructure/register-pos-models.js";
export type {
  PosCaller,
  PosCatalogReader,
  PosCurrencyReader,
  PosLocationReader,
  PosPaymentPort,
  PosRateLimit,
  PosSettings,
  PosSettingsReader,
  PosSoldOrdersReader,
  PosReceivePaymentInput,
} from "./application/ports/pos-ports.js";

/** What the module cannot build itself: other modules' data and services, adapted in routes/pos-adapters.ts. */
export interface PosTenantDependencies {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
  readonly caller: PosCaller;
  readonly locations: PosLocationReader;
  readonly currency: PosCurrencyReader;
  readonly settings: PosSettingsReader;
  readonly sales: InstantSaleService;
  readonly payments: PosPaymentPort;
  readonly soldOrders: PosSoldOrdersReader;
  readonly catalog: PosCatalogReader;
  readonly rateLimit: PosRateLimit;
  /** Keys the pairing-code HMAC (`OTP_SECRET`). Never logged. */
  readonly pairingSecret: string;
  readonly isSecureCookies: boolean;
}

export function buildPosRouter(dependencies: PosTenantDependencies): Router {
  const devices = new MongoPosDeviceRepository();
  const sessions = new MongoPosSessionRepository();
  const unitOfWork = new MongoUnitOfWork();
  const { clock, audit } = dependencies;
  const deviceWrite = { devices, unitOfWork, audit, clock };
  const controller = new PosController({
    createDevice: new CreatePosDeviceUseCase({
      ...deviceWrite,
      locations: dependencies.locations,
      pairingSecret: dependencies.pairingSecret,
    }),
    pairDevice: new PairPosDeviceUseCase({
      ...deviceWrite,
      rateLimit: dependencies.rateLimit,
      pairingSecret: dependencies.pairingSecret,
    }),
    revokeDevice: new RevokePosDeviceUseCase(deviceWrite),
    listDevices: new ListPosDevicesUseCase({ devices, clock }),
    openSession: new OpenPosSessionUseCase({
      sessions,
      caller: dependencies.caller,
      currency: dependencies.currency,
      unitOfWork,
      audit,
      clock,
    }),
    closeSession: new ClosePosSessionUseCase({
      sessions,
      payments: dependencies.payments,
      soldOrders: dependencies.soldOrders,
      caller: dependencies.caller,
      unitOfWork,
      audit,
      events: kernelEventPublisher,
      clock,
    }),
    getZReport: new GetPosZReportUseCase({ sessions, caller: dependencies.caller }),
    createSale: new CreatePosSaleUseCase({
      sales: dependencies.sales,
      payments: dependencies.payments,
      sessions,
      settings: dependencies.settings,
      caller: dependencies.caller,
      unitOfWork,
      audit,
      clock,
    }),
    catalogSnapshot: new GetPosCatalogSnapshotUseCase({ catalog: dependencies.catalog, clock }),
    isSecureCookies: dependencies.isSecureCookies,
  });
  return buildPosTenantRouter({
    controller,
    permission: dependencies.permission,
    idempotency: dependencies.idempotency,
    requireDevice: requirePosDevice({ devices, clock }),
  });
}
