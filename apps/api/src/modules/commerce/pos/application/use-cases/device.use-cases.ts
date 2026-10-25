import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import {
  POS_PAIRING_RULES,
  type PosDeviceCreatedResponse,
  type PosDeviceResponse,
  type PosPairResponse,
} from "@banijjik/contracts/pos";
import {
  asId,
  newId,
  type LocationId,
  type OrganizationId,
  type PosDeviceId,
  type UserId,
} from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import {
  locationForbidden,
  pairingInvalid,
  recordNotFound,
  retryableConflict,
} from "../../domain/errors.js";
import { canPairWith, newPosDevice, type PosDevice } from "../../domain/pos-device.entity.js";
import {
  generateDeviceSecret,
  generatePairingCode,
  hashDeviceSecret,
  hashPairingCode,
} from "../pairing-secrets.js";
import type {
  Page,
  PosDeviceRepository,
  PosLocationReader,
  PosRateLimit,
  PosUnitOfWork,
} from "../ports/pos-ports.js";

const MILLISECONDS_PER_MINUTE = 60_000;
const MAX_CODE_ATTEMPTS = 5;

export function toDeviceResponse(device: PosDevice, now: Date): PosDeviceResponse {
  return {
    posDeviceId: device.posDeviceId,
    locationId: device.locationId,
    name: device.name,
    status: device.status,
    pairedAt: device.pairedAt?.toISOString() ?? null,
    lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
    isAwaitingPairing: canPairWith(device, now),
    version: device.version,
    createdAt: device.createdAt.toISOString(),
  };
}

export interface DeviceWriteDependencies {
  readonly devices: PosDeviceRepository;
  readonly unitOfWork: PosUnitOfWork;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

export interface CreateDeviceDependencies extends DeviceWriteDependencies {
  readonly locations: PosLocationReader;
  /** Keys the pairing-code HMAC (`OTP_SECRET`). Never logged. */
  readonly pairingSecret: string;
}

/** `POST /pos/devices`: the device and its one-time pairing code, shown once (plan decision 2). */
export class CreatePosDeviceUseCase {
  constructor(private readonly dependencies: CreateDeviceDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly allowedLocationIds: readonly string[] | "ALL";
    readonly locationId: string;
    readonly name: string;
  }): Promise<PosDeviceCreatedResponse> {
    const { devices, locations, unitOfWork, audit, clock, pairingSecret } = this.dependencies;
    if (
      input.allowedLocationIds !== "ALL" &&
      !input.allowedLocationIds.includes(input.locationId)
    ) {
      throw locationForbidden();
    }
    if (!(await locations.isActiveLocation(input.locationId))) throw recordNotFound();
    const now = clock.now();
    const { code, codeHash } = await this.freeCode(input.organizationId, pairingSecret);
    const device = newPosDevice({
      posDeviceId: newId<PosDeviceId>(),
      organizationId: input.organizationId,
      locationId: asId<LocationId>(input.locationId),
      name: input.name,
      pairingCodeHash: codeHash,
      pairingExpiresAt: new Date(
        now.getTime() + POS_PAIRING_RULES.ttlMinutes * MILLISECONDS_PER_MINUTE,
      ),
      actorUserId: input.actorUserId,
      now,
    });
    await unitOfWork.run(async () => {
      await devices.insert(device);
      await audit.record({
        action: AUDIT_ACTION.POS_DEVICE_CREATED,
        entityType: AUDIT_ENTITY_TYPE.posDevice,
        entityId: device.posDeviceId,
        changes: { name: { to: device.name }, locationId: { to: device.locationId } },
      });
    });
    return {
      ...toDeviceResponse(device, now),
      pairingCode: code,
      pairingExpiresAt: device.pairingExpiresAt?.toISOString() ?? now.toISOString(),
    };
  }

  /** A code no other waiting device holds; the unique index is the backstop for a race. */
  private async freeCode(
    organizationId: OrganizationId,
    pairingSecret: string,
  ): Promise<{ code: string; codeHash: string }> {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
      const code = generatePairingCode();
      const codeHash = hashPairingCode(pairingSecret, organizationId, code);
      if ((await this.dependencies.devices.findByPairingCodeHash(codeHash)) === undefined) {
        return { code, codeHash };
      }
    }
    throw retryableConflict();
  }
}

export interface PairDeviceDependencies extends DeviceWriteDependencies {
  readonly rateLimit: PosRateLimit;
  readonly pairingSecret: string;
}

/** `POST /pos/devices/pair`: exchanges the code for the device cookie secret, once (plan decision 2). */
export class PairPosDeviceUseCase {
  constructor(private readonly dependencies: PairDeviceDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly pairingCode: string;
  }): Promise<{ readonly device: PosPairResponse; readonly deviceSecret: string }> {
    const { devices, unitOfWork, audit, clock, rateLimit, pairingSecret } = this.dependencies;
    await rateLimit.consumePairingAttempt(input.actorUserId);
    const now = clock.now();
    const codeHash = hashPairingCode(pairingSecret, input.organizationId, input.pairingCode);
    const waiting = await devices.findByPairingCodeHash(codeHash);
    if (waiting === undefined || !canPairWith(waiting, now)) throw pairingInvalid();
    const deviceSecret = generateDeviceSecret();
    const paired = await unitOfWork.run(async () => {
      const claimed = await devices.claimPairing({
        posDeviceId: waiting.posDeviceId,
        pairingCodeHash: codeHash,
        secretHash: hashDeviceSecret(deviceSecret),
        now,
        actorUserId: input.actorUserId,
      });
      if (claimed === undefined) throw pairingInvalid();
      await audit.record({
        action: AUDIT_ACTION.POS_DEVICE_PAIRED,
        entityType: AUDIT_ENTITY_TYPE.posDevice,
        entityId: claimed.posDeviceId,
      });
      return claimed;
    });
    return {
      device: { posDeviceId: paired.posDeviceId, locationId: paired.locationId, name: paired.name },
      deviceSecret,
    };
  }
}

/** `POST /pos/devices/{posDeviceId}/revoke`: no new sale; an open session can still be closed. */
export class RevokePosDeviceUseCase {
  constructor(private readonly dependencies: DeviceWriteDependencies) {}

  async execute(input: {
    readonly actorUserId: UserId;
    readonly posDeviceId: PosDeviceId;
    readonly version: number;
  }): Promise<PosDeviceResponse> {
    const { devices, unitOfWork, audit, clock } = this.dependencies;
    const now = clock.now();
    const revoked = await unitOfWork.run(async () => {
      const done = await devices.revoke({
        posDeviceId: input.posDeviceId,
        expectedVersion: input.version,
        now,
        actorUserId: input.actorUserId,
      });
      await audit.record({
        action: AUDIT_ACTION.POS_DEVICE_REVOKED,
        entityType: AUDIT_ENTITY_TYPE.posDevice,
        entityId: done.posDeviceId,
      });
      return done;
    });
    return toDeviceResponse(revoked, now);
  }
}

/** `GET /pos/devices`: the devices at the locations the caller manages. */
export class ListPosDevicesUseCase {
  constructor(private readonly dependencies: Pick<DeviceWriteDependencies, "devices" | "clock">) {}

  async execute(input: {
    readonly locationId?: string | undefined;
    readonly page: number;
    readonly limit: number;
  }): Promise<Page<PosDeviceResponse>> {
    const { devices, clock } = this.dependencies;
    const now = clock.now();
    const found = await devices.list({
      locationId: input.locationId === undefined ? undefined : asId<LocationId>(input.locationId),
      page: input.page,
      limit: input.limit,
    });
    return {
      items: found.items.map((device) => toDeviceResponse(device, now)),
      hasNext: found.hasNext,
    };
  }
}
