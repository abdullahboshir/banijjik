import type { Money } from "@banijjik/contracts/pricing";
import type {
  CreateDeliveryZoneRequest,
  DeliveryZoneStatus,
  UpdateDeliveryZoneRequest,
} from "@banijjik/contracts/sales/delivery";
import type { OrganizationId, UserId } from "@banijjik/ids";
import { DeliveryZone, type DeliveryZoneChanges } from "../../domain/delivery-zone.entity.js";
import { recordNotFound } from "../../domain/errors.js";
import type { SalesDependencies } from "../sales-dependencies.js";

export interface DeliveryZoneResponse {
  readonly deliveryZoneId: string;
  readonly zoneKey: string;
  readonly name: DeliveryZone["name"];
  readonly areaCodes: readonly string[];
  readonly fee: Money;
  readonly status: DeliveryZoneStatus;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DeliveryZoneListResult {
  readonly items: readonly DeliveryZoneResponse[];
  readonly hasNext: boolean;
}

export interface DeliveryZoneActorInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
}

function toResponse(zone: DeliveryZone): DeliveryZoneResponse {
  return {
    deliveryZoneId: zone.deliveryZoneId,
    zoneKey: zone.zoneKey,
    name: zone.name,
    areaCodes: zone.areaCodes,
    fee: zone.fee,
    status: zone.status,
    version: zone.version,
    createdAt: zone.createdAt.toISOString(),
    updatedAt: zone.updatedAt.toISOString(),
  };
}

function feeOf(amount: number, currency: Money["currency"]): Money {
  return { amount, currency };
}

function changesOf(
  body: UpdateDeliveryZoneRequest,
  currency: Money["currency"],
): DeliveryZoneChanges {
  return {
    ...(body.name === undefined ? {} : { name: body.name }),
    ...(body.areaCodes === undefined ? {} : { areaCodes: body.areaCodes }),
    ...(body.feeMinor === undefined ? {} : { fee: feeOf(body.feeMinor, currency) }),
    ...(body.status === undefined ? {} : { status: body.status }),
  };
}

/** Organization-wide delivery zones: create, list, read and patch. */
export class ManageDeliveryZonesUseCase {
  constructor(private readonly dependencies: SalesDependencies) {}

  async list(
    input: DeliveryZoneActorInput & { readonly page: number; readonly limit: number },
  ): Promise<DeliveryZoneListResult> {
    const page = await this.dependencies.deliveryZones.list({
      organizationId: input.organizationId,
      page: input.page,
      limit: input.limit,
    });
    return { items: page.items.map(toResponse), hasNext: page.hasNext };
  }

  async get(
    input: DeliveryZoneActorInput & { readonly deliveryZoneId: string },
  ): Promise<DeliveryZoneResponse> {
    return toResponse(await this.requireZone(input.organizationId, input.deliveryZoneId));
  }

  async create(
    input: DeliveryZoneActorInput & { readonly body: CreateDeliveryZoneRequest },
  ): Promise<DeliveryZoneResponse> {
    const currency = await this.dependencies.currency.read(input.organizationId);
    const zone = DeliveryZone.create({
      organizationId: input.organizationId,
      zoneKey: input.body.zoneKey,
      name: input.body.name,
      areaCodes: input.body.areaCodes,
      fee: feeOf(input.body.feeMinor, currency),
      status: input.body.status,
      actorUserId: input.actorUserId,
      now: this.dependencies.clock.now(),
    });
    await this.dependencies.deliveryZones.insert(zone);
    return toResponse(zone);
  }

  async update(
    input: DeliveryZoneActorInput & {
      readonly deliveryZoneId: string;
      readonly body: UpdateDeliveryZoneRequest;
    },
  ): Promise<DeliveryZoneResponse> {
    const existing = await this.requireZone(input.organizationId, input.deliveryZoneId);
    const currency = await this.dependencies.currency.read(input.organizationId);
    const changed = existing.withChanges(
      changesOf(input.body, currency),
      input.actorUserId,
      this.dependencies.clock.now(),
    );
    return toResponse(await this.dependencies.deliveryZones.update(changed, input.body.version));
  }

  private async requireZone(
    organizationId: OrganizationId,
    deliveryZoneId: string,
  ): Promise<DeliveryZone> {
    const zone = await this.dependencies.deliveryZones.findById(organizationId, deliveryZoneId);
    if (zone === undefined) throw recordNotFound();
    return zone;
  }
}
