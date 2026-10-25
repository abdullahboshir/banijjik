import { POS_DEVICE_COOKIE_NAME } from "@banijjik/contracts/pos";
import type { Express } from "express";
import type { Response } from "supertest";
import { expect } from "vitest";
import { asCookies, callApi, parseSetCookies, type ApiCall } from "./auth-api-client.js";
import { addInventoryItem, publishOffering, receiveStock } from "./sales-api-world.js";
import type { SalesShop } from "./sales-api-world.js";
import type { ApiActor } from "./two-organizations.js";

const HTTP_OK = 200;
const HTTP_CREATED = 201;

export function posPath(organizationId: string, suffix: string): string {
  return `/orgs/${organizationId}/pos${suffix}`;
}

export function bdt(amount: number): { amount: number; currency: string } {
  return { amount, currency: "BDT" };
}

/** A browser paired with a device: the cashier who paired it and the cookie secret the pairing set. */
export interface PosTill {
  readonly app: Express;
  readonly cashier: ApiActor;
  readonly organizationId: string;
  readonly locationId: string;
  readonly posDeviceId: string;
  readonly deviceSecret: string;
}

export interface CreatedDevice {
  readonly posDeviceId: string;
  readonly pairingCode: string;
  readonly version: number;
}

export async function createDevice(
  manager: ApiActor,
  input: { readonly organizationId: string; readonly locationId: string; readonly name?: string },
): Promise<CreatedDevice> {
  const response = await manager.call("post", posPath(input.organizationId, "/devices"), {
    locationId: input.locationId,
    name: input.name ?? "Counter 1",
  });
  expect(response.status, JSON.stringify(response.body)).toBe(HTTP_CREATED);
  const data = response.body.data;
  return {
    posDeviceId: data.posDeviceId as string,
    pairingCode: data.pairingCode as string,
    version: data.version as number,
  };
}

/** `POST /pos/devices/pair` as the given member; the response carries the Set-Cookie of the device. */
export function pairDevice(
  app: Express,
  member: ApiActor,
  input: { readonly organizationId: string; readonly pairingCode: string },
): Promise<Response> {
  return callApi(app, {
    method: "post",
    path: `/api/v1${posPath(input.organizationId, "/devices/pair")}`,
    body: { pairingCode: input.pairingCode },
    cookies: asCookies(member.person.session),
  });
}

export function deviceSecretOf(response: Response): string | undefined {
  return parseSetCookies(response).find((cookie) => cookie.name === POS_DEVICE_COOKIE_NAME)?.value;
}

/** The manager creates a device at the location and the cashier pairs it: a till ready to sell. */
export async function pairedTill(
  app: Express,
  input: {
    readonly manager: ApiActor;
    readonly cashier: ApiActor;
    readonly organizationId: string;
    readonly locationId: string;
    readonly name?: string;
  },
): Promise<PosTill> {
  const device = await createDevice(input.manager, input);
  const paired = await pairDevice(app, input.cashier, {
    organizationId: input.organizationId,
    pairingCode: device.pairingCode,
  });
  expect(paired.status, JSON.stringify(paired.body)).toBe(HTTP_OK);
  const deviceSecret = deviceSecretOf(paired);
  if (deviceSecret === undefined) throw new Error("pairing set no device cookie");
  return {
    app,
    cashier: input.cashier,
    organizationId: input.organizationId,
    locationId: input.locationId,
    posDeviceId: device.posDeviceId,
    deviceSecret,
  };
}

/** A request made from the till's browser: the member's session plus the device cookie. */
export async function tillCall(
  till: PosTill,
  call: Pick<ApiCall, "method" | "body" | "idempotencyKey"> & {
    readonly suffix: string;
    readonly as?: ApiActor;
    readonly withoutDevice?: boolean;
  },
): Promise<Response> {
  const member = call.as ?? till.cashier;
  return await callApi(till.app, {
    method: call.method,
    path: `/api/v1${posPath(till.organizationId, call.suffix)}`,
    ...(call.body === undefined ? {} : { body: call.body }),
    ...(call.idempotencyKey === undefined ? {} : { idempotencyKey: call.idempotencyKey }),
    cookies: {
      ...asCookies(member.person.session),
      ...(call.withoutDevice === true ? {} : { [POS_DEVICE_COOKIE_NAME]: till.deviceSecret }),
    },
  });
}

export interface SessionRow {
  readonly posSessionId: string;
  readonly status: string;
  readonly openingFloat: { amount: number };
  readonly expectedCash: { amount: number } | null;
  readonly countedCash: { amount: number } | null;
  readonly variance: { amount: number } | null;
  readonly zReportNumber: string | null;
  readonly version: number;
}

export async function openRegister(till: PosTill, floatAmount = 0): Promise<SessionRow> {
  const response = await tillCall(till, {
    method: "post",
    suffix: "/sessions",
    body: { openingFloat: bdt(floatAmount) },
  });
  expect(response.status, JSON.stringify(response.body)).toBe(HTTP_CREATED);
  return response.body.data as SessionRow;
}

export async function closeRegister(
  till: PosTill,
  input: { readonly session: SessionRow; readonly countedCash: number; readonly as?: ApiActor },
): Promise<Response> {
  return tillCall(till, {
    method: "post",
    suffix: `/sessions/${input.session.posSessionId}/close`,
    body: { countedCash: bdt(input.countedCash), version: input.session.version },
    ...(input.as === undefined ? {} : { as: input.as }),
  });
}

export interface SaleRow {
  readonly order: {
    readonly orderId: string;
    readonly status: string;
    readonly source: string;
    readonly paymentStatus: string;
    readonly totals: { grandTotal: { amount: number } };
    readonly contactId: string | null;
  };
  readonly posSessionId: string | null;
  readonly payments: readonly {
    readonly paymentId: string;
    readonly method: string;
    readonly amount: { amount: number };
  }[];
  readonly storeCreditUsed: { amount: number };
  readonly changeDue: { amount: number };
  readonly dueAmount: { amount: number };
  readonly receiptFooter: string;
}

export function saleCall(till: PosTill, body: object, idempotencyKey?: string): Promise<Response> {
  return tillCall(till, {
    method: "post",
    suffix: "/sales",
    body,
    ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
  });
}

const PACK_GRAMS = 1_000;
const COST_PER_GRAM = 60;

/** A product the till can sell: `packs` tracked packs on the shelf of the shop's location. */
export interface Pack {
  readonly offeringId: string;
  readonly variantId: string;
  readonly inventoryItemId: string;
  readonly priceAmount: number;
}

let packCounter = 0;

export async function stockedPack(
  shop: SalesShop,
  input: { readonly packs: number; readonly priceAmount?: number },
): Promise<Pack> {
  packCounter += 1;
  const priceAmount = input.priceAmount ?? 10_000;
  const inventoryItemId = await addInventoryItem(shop, `Rice ${packCounter}`);
  const pack = await publishOffering(shop, {
    kind: "PRODUCT",
    name: `Rice 1kg pack ${packCounter}`,
    priceAmount,
    stockComponents: [{ inventoryItemId, quantity: PACK_GRAMS }],
  });
  await receiveStock(shop, [
    {
      inventoryItemId,
      quantity: input.packs * PACK_GRAMS,
      unitCostAmount: COST_PER_GRAM,
    },
  ]);
  return { ...pack, inventoryItemId, priceAmount };
}

export function lineOf(
  pack: Pack,
  quantity = 1,
): { offeringId: string; variantId: string; quantity: number } {
  return { offeringId: pack.offeringId, variantId: pack.variantId, quantity };
}

export const GRAMS_PER_PACK = PACK_GRAMS;
