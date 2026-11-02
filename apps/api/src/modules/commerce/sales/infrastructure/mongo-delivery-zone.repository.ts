import type { CurrencyCode } from "@banijjik/contracts";
import type { Money } from "@banijjik/contracts/pricing";
import { DELIVERY_ZONE_STATUS } from "@banijjik/contracts/sales";
import { asId, InvalidIdError, type OrganizationId, type UserId } from "@banijjik/ids";
import type { Model } from "mongoose";
import { conflict } from "../../../../kernel/http/index.js";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type {
  DeliveryZonePage,
  DeliveryZoneRepository,
} from "../application/ports/delivery-zone.repository.js";
import { DeliveryZone, normalizeDeliveryAreaCode } from "../domain/delivery-zone.entity.js";
import { DELIVERY_ZONE_MODEL_NAME, type DeliveryZoneDocument } from "./delivery-zone.schema.js";

function zoneModel(): Model<DeliveryZoneDocument> {
  return models({}).get<DeliveryZoneDocument>(DELIVERY_ZONE_MODEL_NAME);
}

function moneyOf(row: DeliveryZoneDocument["fee"]): Money {
  return { amount: row.amount, currency: row.currency as CurrencyCode };
}

function actorOf(value: string | null): UserId {
  if (value === null) throw new InvalidIdError();
  return asId<UserId>(value);
}

function toZone(row: DeliveryZoneDocument): DeliveryZone {
  return DeliveryZone.restore({
    deliveryZoneId: row.deliveryZoneId,
    organizationId: asId<OrganizationId>(row.organizationId),
    zoneKey: row.zoneKey,
    name: { bn: row.name.bn, en: row.name.en },
    areaCodes: row.areaCodes,
    fee: moneyOf(row.fee),
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByUserId: actorOf(row.createdByUserId),
    updatedByUserId: actorOf(row.updatedByUserId),
  });
}

function toDocument(zone: DeliveryZone): DeliveryZoneDocument {
  return {
    deliveryZoneId: zone.deliveryZoneId,
    organizationId: zone.organizationId,
    zoneKey: zone.zoneKey,
    name: { bn: zone.name.bn, en: zone.name.en },
    areaCodes: [...zone.areaCodes],
    fee: { amount: zone.fee.amount, currency: zone.fee.currency },
    status: zone.status,
    version: zone.version,
    createdAt: zone.createdAt,
    updatedAt: zone.updatedAt,
    createdByUserId: zone.createdByUserId,
    updatedByUserId: zone.updatedByUserId,
  };
}

type MutableZoneFields = Omit<
  DeliveryZoneDocument,
  "deliveryZoneId" | "organizationId" | "zoneKey" | "version"
>;

function mutableFieldsOf(zone: DeliveryZone): MutableZoneFields {
  return {
    name: { bn: zone.name.bn, en: zone.name.en },
    areaCodes: [...zone.areaCodes],
    fee: { amount: zone.fee.amount, currency: zone.fee.currency },
    status: zone.status,
    createdAt: zone.createdAt,
    updatedAt: zone.updatedAt,
    createdByUserId: zone.createdByUserId,
    updatedByUserId: zone.updatedByUserId,
  };
}

export class MongoDeliveryZoneRepository implements DeliveryZoneRepository {
  async insert(zone: DeliveryZone): Promise<void> {
    try {
      await zoneModel().create([toDocument(zone)], sessionOption(getActiveSession()));
    } catch (error) {
      if (isDuplicateKeyError(error)) throw conflict({});
      throw error;
    }
  }

  async findById(
    organizationId: OrganizationId,
    deliveryZoneId: string,
  ): Promise<DeliveryZone | undefined> {
    const row = await zoneModel()
      .findOne({ organizationId, deliveryZoneId }, { _id: 0 }, sessionOption(getActiveSession()))
      .lean<DeliveryZoneDocument>();
    return row === null ? undefined : toZone(row);
  }

  async findActiveByAreaCode(input: {
    readonly organizationId: OrganizationId;
    readonly areaCode: string;
  }): Promise<DeliveryZone | undefined> {
    const row = await zoneModel()
      .findOne(
        {
          organizationId: input.organizationId,
          status: DELIVERY_ZONE_STATUS.ACTIVE,
          areaCodes: normalizeDeliveryAreaCode(input.areaCode),
        },
        { _id: 0 },
        sessionOption(getActiveSession()),
      )
      .lean<DeliveryZoneDocument>();
    return row === null ? undefined : toZone(row);
  }

  async list(input: {
    readonly organizationId: OrganizationId;
    readonly page: number;
    readonly limit: number;
  }): Promise<DeliveryZonePage> {
    const rows = await zoneModel()
      .find({ organizationId: input.organizationId }, { _id: 0 }, sessionOption(getActiveSession()))
      .sort({ createdAt: -1, deliveryZoneId: 1 })
      .skip((input.page - 1) * input.limit)
      .limit(input.limit + 1)
      .lean<DeliveryZoneDocument[]>();
    return {
      items: rows.slice(0, input.limit).map(toZone),
      hasNext: rows.length > input.limit,
    };
  }

  async update(zone: DeliveryZone, expectedVersion: number): Promise<DeliveryZone> {
    try {
      const updated = await updateVersioned({
        model: zoneModel(),
        filter: { organizationId: zone.organizationId, deliveryZoneId: zone.deliveryZoneId },
        expectedVersion,
        update: { $set: mutableFieldsOf(zone) },
      });
      return toZone(updated);
    } catch (error) {
      if (isDuplicateKeyError(error)) throw conflict({});
      throw error;
    }
  }
}
