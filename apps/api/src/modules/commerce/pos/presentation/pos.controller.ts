import {
  POS_DEVICE_COOKIE_MAX_AGE_DAYS,
  POS_DEVICE_COOKIE_NAME,
  POS_DEVICE_COOKIE_PATH,
} from "@banijjik/contracts/pos";
import { asId, type PosDeviceId, type PosHeldCartId, type PosSessionId } from "@banijjik/ids";
import type {
  PosCatalogSnapshotQuery,
  PosCollectionBody,
  PosDeviceCreateBody,
  PosDeviceListQuery,
  PosDevicePairBody,
  PosDeviceRevokeBody,
  PosHeldCartCreateBody,
  PosHeldCartDeleteQuery,
  PosReturnBody,
  PosSaleBody,
  PosSessionCloseBody,
  PosSessionListQuery,
  PosSessionOpenBody,
} from "@banijjik/validation/pos";
import type { Request, RequestHandler } from "express";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type { GetPosCatalogSnapshotUseCase } from "../application/use-cases/catalog-snapshot.use-case.js";
import type { CollectPosDueUseCase } from "../application/use-cases/collect-pos-due.use-case.js";
import type { CreatePosReturnUseCase } from "../application/use-cases/create-pos-return.use-case.js";
import type { CreatePosSaleUseCase } from "../application/use-cases/create-pos-sale.use-case.js";
import type {
  CreatePosDeviceUseCase,
  ListPosDevicesUseCase,
  PairPosDeviceUseCase,
  RevokePosDeviceUseCase,
} from "../application/use-cases/device.use-cases.js";
import type {
  CreatePosHeldCartUseCase,
  DeletePosHeldCartUseCase,
  ListPosHeldCartsUseCase,
} from "../application/use-cases/held-cart.use-cases.js";
import type {
  GetCurrentPosSessionUseCase,
  ListPosSessionsUseCase,
} from "../application/use-cases/session-read.use-cases.js";
import type {
  ClosePosSessionUseCase,
  GetPosZReportUseCase,
  OpenPosSessionUseCase,
} from "../application/use-cases/session.use-cases.js";
import { readPosDevice } from "./require-pos-device.middleware.js";

const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;
const MILLISECONDS_PER_DAY = 86_400_000;

export interface PosControllerDependencies {
  readonly createDevice: CreatePosDeviceUseCase;
  readonly pairDevice: PairPosDeviceUseCase;
  readonly revokeDevice: RevokePosDeviceUseCase;
  readonly listDevices: ListPosDevicesUseCase;
  readonly openSession: OpenPosSessionUseCase;
  readonly closeSession: ClosePosSessionUseCase;
  readonly getZReport: GetPosZReportUseCase;
  readonly getCurrentSession: GetCurrentPosSessionUseCase;
  readonly listSessions: ListPosSessionsUseCase;
  readonly createSale: CreatePosSaleUseCase;
  readonly createHeldCart: CreatePosHeldCartUseCase;
  readonly listHeldCarts: ListPosHeldCartsUseCase;
  readonly deleteHeldCart: DeletePosHeldCartUseCase;
  readonly collectDue: CollectPosDueUseCase;
  readonly createReturn: CreatePosReturnUseCase;
  readonly catalogSnapshot: GetPosCatalogSnapshotUseCase;
  /** Cookies are Secure everywhere except local development. */
  readonly isSecureCookies: boolean;
}

function paramOf(request: Request, name: string): string {
  return String(request.params[name]);
}

export class PosController {
  constructor(private readonly dependencies: PosControllerDependencies) {}

  readonly createDevice: RequestHandler = async (request, response) => {
    const body: PosDeviceCreateBody = request.body;
    const { organizationId, actorUserId, allowedLocationIds } = readTenantCaller();
    const created = await this.dependencies.createDevice.execute({
      organizationId,
      actorUserId,
      allowedLocationIds,
      locationId: body.locationId,
      name: body.name,
    });
    sendData(response, created, { status: HTTP_CREATED });
  };

  /** The secret leaves only here, in an httpOnly cookie; no body, header or log ever carries it. */
  readonly pairDevice: RequestHandler = async (request, response) => {
    const body: PosDevicePairBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    const paired = await this.dependencies.pairDevice.execute({
      organizationId,
      actorUserId,
      pairingCode: body.pairingCode,
    });
    response.cookie(POS_DEVICE_COOKIE_NAME, paired.deviceSecret, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.dependencies.isSecureCookies,
      path: POS_DEVICE_COOKIE_PATH,
      maxAge: POS_DEVICE_COOKIE_MAX_AGE_DAYS * MILLISECONDS_PER_DAY,
    });
    sendData(response, paired.device);
  };

  readonly revokeDevice: RequestHandler = async (request, response) => {
    const body: PosDeviceRevokeBody = request.body;
    const { actorUserId } = readTenantCaller();
    const revoked = await this.dependencies.revokeDevice.execute({
      actorUserId,
      posDeviceId: asId<PosDeviceId>(paramOf(request, "posDeviceId")),
      version: body.version,
    });
    sendData(response, revoked);
  };

  readonly listDevices: RequestHandler = async (_request, response) => {
    const query: PosDeviceListQuery = response.locals["validated"].query;
    const result = await this.dependencies.listDevices.execute(query);
    sendData(response, result.items, {
      meta: { page: query.page, limit: query.limit, hasNext: result.hasNext },
    });
  };

  readonly openSession: RequestHandler = async (request, response) => {
    const body: PosSessionOpenBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    const session = await this.dependencies.openSession.execute({
      organizationId,
      actorUserId,
      device: readPosDevice(response),
      openingFloat: body.openingFloat,
    });
    sendData(response, session, { status: HTTP_CREATED });
  };

  readonly closeSession: RequestHandler = async (request, response) => {
    const body: PosSessionCloseBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    const closed = await this.dependencies.closeSession.execute({
      organizationId,
      actorUserId,
      posSessionId: asId<PosSessionId>(paramOf(request, "posSessionId")),
      countedCash: body.countedCash,
      version: body.version,
      note: body.note ?? null,
    });
    sendData(response, closed);
  };

  readonly getZReport: RequestHandler = async (request, response) => {
    const { organizationId, actorUserId } = readTenantCaller();
    const report = await this.dependencies.getZReport.execute({
      organizationId,
      actorUserId,
      posSessionId: asId<PosSessionId>(paramOf(request, "posSessionId")),
    });
    sendData(response, report);
  };

  readonly getCurrentSession: RequestHandler = async (_request, response) => {
    const session = await this.dependencies.getCurrentSession.execute({
      device: readPosDevice(response),
    });
    sendData(response, session);
  };

  readonly listSessions: RequestHandler = async (_request, response) => {
    const query: PosSessionListQuery = response.locals["validated"].query;
    const { allowedLocationIds } = readTenantCaller();
    const page = await this.dependencies.listSessions.execute({
      allowedLocationIds,
      locationId: query.locationId,
      status: query.status,
      cursor: query.cursor,
      limit: query.limit,
    });
    sendData(response, page);
  };

  readonly createSale: RequestHandler = async (request, response) => {
    const body: PosSaleBody = request.body;
    const { organizationId, actorUserId, allowedLocationIds } = readTenantCaller();
    const sale = await this.dependencies.createSale.execute({
      organizationId,
      actorUserId,
      allowedLocationIds,
      device: readPosDevice(response),
      body,
    });
    sendData(response, sale, { status: HTTP_CREATED });
  };

  readonly createHeldCart: RequestHandler = async (request, response) => {
    const body: PosHeldCartCreateBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    const cart = await this.dependencies.createHeldCart.execute({
      organizationId,
      actorUserId,
      device: readPosDevice(response),
      body,
    });
    sendData(response, cart, { status: HTTP_CREATED });
  };

  readonly listHeldCarts: RequestHandler = async (_request, response) => {
    const carts = await this.dependencies.listHeldCarts.execute({
      device: readPosDevice(response),
    });
    sendData(response, carts);
  };

  readonly deleteHeldCart: RequestHandler = async (request, response) => {
    const query: PosHeldCartDeleteQuery = response.locals["validated"].query;
    await this.dependencies.deleteHeldCart.execute({
      device: readPosDevice(response),
      posHeldCartId: asId<PosHeldCartId>(paramOf(request, "posHeldCartId")),
      version: query.version,
    });
    response.status(HTTP_NO_CONTENT).end();
  };

  readonly collectDue: RequestHandler = async (request, response) => {
    const body: PosCollectionBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    const collected = await this.dependencies.collectDue.execute({
      organizationId,
      actorUserId,
      device: readPosDevice(response),
      body,
    });
    sendData(response, collected, { status: HTTP_CREATED });
  };

  readonly createReturn: RequestHandler = async (request, response) => {
    const body: PosReturnBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    const created = await this.dependencies.createReturn.execute({
      organizationId,
      actorUserId,
      device: readPosDevice(response),
      body,
    });
    sendData(response, created, { status: HTTP_CREATED });
  };

  readonly catalogSnapshot: RequestHandler = async (_request, response) => {
    const query: PosCatalogSnapshotQuery = response.locals["validated"].query;
    const { organizationId } = readTenantCaller();
    sendData(
      response,
      await this.dependencies.catalogSnapshot.execute({
        organizationId,
        device: readPosDevice(response),
        since: query.since,
        cursor: query.cursor,
        limit: query.limit,
      }),
    );
  };
}
