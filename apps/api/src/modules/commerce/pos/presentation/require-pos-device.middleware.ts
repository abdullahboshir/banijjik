import { POS_DEVICE_COOKIE_NAME, POS_DEVICE_STATUS } from "@banijjik/contracts/pos";
import type { RequestHandler, Response } from "express";
import { readCookie } from "../../../../kernel/http/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import { hashDeviceSecret } from "../application/pairing-secrets.js";
import type { PosDeviceRepository } from "../application/ports/pos-ports.js";
import type { PosDeviceContext } from "../application/use-cases/session.use-cases.js";
import { deviceRequired } from "../domain/errors.js";

const DEVICE_LOCAL = "posDevice";
const LAST_SEEN_REFRESH_MS = 5 * 60_000;

export interface RequirePosDeviceDependencies {
  readonly devices: Pick<PosDeviceRepository, "findBySecretHash" | "touchLastSeen">;
  readonly clock: Clock;
}

/**
 * Finds the device behind the `pos_device` cookie and puts its id and location on the response, so
 * every POS write uses the device's location and never a body field (plan 3.9 decision 2). It runs
 * after `permission(key)`, whose narrowed locations the device lookup obeys: a device of another
 * location, another organization, or a revoked one answers the same `403 errors.pos_device_required`.
 */
export function requirePosDevice(dependencies: RequirePosDeviceDependencies): RequestHandler {
  const { devices, clock } = dependencies;
  return async (request, response, next) => {
    const secret = readCookie(request, POS_DEVICE_COOKIE_NAME);
    if (secret === undefined || secret === "") throw deviceRequired();
    const device = await devices.findBySecretHash(hashDeviceSecret(secret));
    if (device === undefined || device.status !== POS_DEVICE_STATUS.ACTIVE) throw deviceRequired();
    const now = clock.now();
    const isStale =
      device.lastSeenAt === null ||
      now.getTime() - device.lastSeenAt.getTime() > LAST_SEEN_REFRESH_MS;
    if (isStale) await devices.touchLastSeen(device.posDeviceId, now);
    const context: PosDeviceContext = {
      posDeviceId: device.posDeviceId,
      locationId: device.locationId,
    };
    response.locals[DEVICE_LOCAL] = context;
    next();
  };
}

function isDeviceContext(value: unknown): value is PosDeviceContext {
  return (
    typeof value === "object" && value !== null && "posDeviceId" in value && "locationId" in value
  );
}

/** The device `requirePosDevice` found; a route without the middleware answers like a missing device. */
export function readPosDevice(response: Response): PosDeviceContext {
  const context: unknown = response.locals[DEVICE_LOCAL];
  if (!isDeviceContext(context)) throw deviceRequired();
  return context;
}
