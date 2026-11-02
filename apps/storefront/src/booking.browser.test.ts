import http from "node:http";
import {
  BOOKING_DEPOSIT_REQUIRED_SETTING_KEY,
  BOOKING_DEPOSIT_VALUE_SETTING_KEY,
  BOOKING_MIN_NOTICE_MINUTES_SETTING_KEY,
  DEPOSIT_REQUIRED,
} from "@banijjik/contracts/booking";
import { WEBSITE_CHECKOUT_ENABLED_SETTING_KEY } from "@banijjik/contracts/website";
import { STOREFRONT_CATALOGS } from "@banijjik/i18n";
import { newId } from "@banijjik/ids";
import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  enableCustomerLogin,
  publishTemplate,
  seedBranding,
  seedOwner,
  seedPublishedSite,
  type Session,
} from "./test-support/seed";
import {
  API_ORIGIN,
  BASE_DOMAIN,
  STOREFRONT_ORIGIN,
  STOREFRONT_PORT,
  latestSmsCode,
  startStorefrontStack,
  type StorefrontStack,
} from "./test-support/storefront-stack";

/** Folded 4.6 booking-page checks: branded SERVICE/PLAN journeys against the real API. */
const SALON_SLUG = "salon-booking";
const SALON_NAME = "সেলুন বুকিং";
const GYM_SLUG = "gym-plans";
const GYM_NAME = "জিম প্ল্যান";
const SERVICE_NAME = "Haircut";
const SERVICE_SLUG = "haircut";
const PLAN_NAME = "Membership Plan";
const PLAN_SLUG = "membership-plan";
const LOC_TWO_NAME = "Gulshan";
const GUEST_NAME = "করিম আহমেদ";
const GUEST_PHONE = "+8801711111111";
const CUSTOMER_PHONE = "+8801712222222";
const PLAN_NOTES = "Need evening class";
const DEPOSIT_MINOR = 10_000;
const SERVICE_PRICE = 50_000;
const PLAN_PRICE = 10_001;
const MOBILE_VIEWPORT = { width: 360, height: 800, isMobile: true, hasTouch: true } as const;
const MIN_TOUCH_TARGET_PX = 44;
const DEADLINE_MS = 30_000;
const POLL_MS = 250;
const IDEMPOTENCY_HEADER = "Idempotency-Key";
const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const PNG_BYTES = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  ),
);

const bn = STOREFRONT_CATALOGS.bn;
const en = STOREFRONT_CATALOGS.en;

function catalogText(catalog: Record<string, string>, key: string): string {
  const value = catalog[key];
  if (value === undefined) throw new Error(`missing storefront text ${key}`);
  return value;
}

const bnText = {
  bookNow: catalogText(bn, "storefront.booking.bookNow"),
  enrollNow: catalogText(bn, "storefront.enrollment.enrollNow"),
  addedToCart: catalogText(bn, "storefront.catalog.addedToCart"),
  proceed: catalogText(bn, "storefront.cart.proceedToCheckout"),
  placeOrder: catalogText(bn, "storefront.checkout.placeOrder"),
  receiptTitle: catalogText(bn, "storefront.requests.checkoutTitle"),
  paymentRequired: catalogText(bn, "storefront.requests.paymentRequired"),
};
const enBookNow = catalogText(en, "storefront.booking.bookNow");

interface OrgWorld {
  readonly organizationId: string;
  readonly locationId: string;
  readonly locationName: string;
  readonly locationTwoId: string;
  readonly locationTwoName: string;
  readonly offeringId: string;
  readonly variantId: string;
  readonly slug: string;
  readonly home: string;
}

let stack: StorefrontStack;
let owner: Session;
let salon: OrgWorld;
let gym: OrgWorld;

beforeAll(async () => {
  stack = await startStorefrontStack();
  await publishTemplate(stack, "SALON");
  await publishTemplate(stack, "GYM");
  owner = await seedOwner();
  salon = await seedSalon();
  gym = await seedGym();
}, 240_000);

afterAll(async () => {
  await stack?.stop();
});

async function ownerCall(method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${API_ORIGIN}/api/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: STOREFRONT_ORIGIN,
      Cookie: owner.cookieHeader,
      [IDEMPOTENCY_HEADER]: newId(),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function requireOk(response: Promise<Response>, label: string): Promise<Response> {
  const resolved = await response;
  if (!resolved.ok) {
    throw new Error(`${label} answered ${resolved.status}: ${await resolved.text()}`);
  }
  return resolved;
}

async function createBusiness(
  slug: string,
  name: string,
  industryTemplateKey: string,
): Promise<string> {
  await requireOk(
    ownerCall("POST", "/me/orgs", { name, slug, industryTemplateKey }),
    `create ${slug}`,
  );
  const listed = await requireOk(ownerCall("GET", "/me/orgs"), "list orgs");
  const body = (await listed.json()) as { data: { organizationId: string; slug: string }[] };
  const found = body.data.find((row) => row.slug === slug);
  if (found === undefined) throw new Error(`no business with slug ${slug}`);
  return found.organizationId;
}

async function listLocations(
  organizationId: string,
): Promise<readonly { locationId: string; name: string }[]> {
  const listed = await requireOk(
    ownerCall("GET", `/orgs/${organizationId}/locations`),
    "list locations",
  );
  const body = (await listed.json()) as { data: { locationId: string; name: string }[] };
  return body.data;
}

async function enableCheckout(organizationId: string): Promise<void> {
  await requireOk(
    ownerCall("PATCH", `/orgs/${organizationId}/settings`, {
      items: [{ settingKey: WEBSITE_CHECKOUT_ENABLED_SETTING_KEY, value: true }],
    }),
    "enable checkout",
  );
}

async function patchSettings(
  organizationId: string,
  items: readonly { settingKey: string; value: unknown }[],
): Promise<void> {
  await requireOk(
    ownerCall("PATCH", `/orgs/${organizationId}/settings`, { items }),
    "patch settings",
  );
}

async function publishOffering(
  organizationId: string,
  body: Record<string, unknown>,
): Promise<{ offeringId: string; variantId: string; version: number }> {
  const created = await requireOk(
    ownerCall("POST", `/orgs/${organizationId}/offerings`, body),
    "create offering",
  );
  const offering = (await created.json()) as {
    data: { offeringId: string; version: number; variants: { variantId: string }[] };
  };
  const published = await requireOk(
    ownerCall("POST", `/orgs/${organizationId}/offerings/${offering.data.offeringId}/publish`, {
      version: offering.data.version,
    }),
    "publish offering",
  );
  const data = (await published.json()) as {
    data: { offeringId: string; version: number; variants: { variantId: string }[] };
  };
  const variantId = data.data.variants[0]?.variantId;
  if (variantId === undefined) throw new Error("the published offering has no variant");
  return { offeringId: data.data.offeringId, variantId, version: data.data.version };
}

async function setOfferingLocation(
  organizationId: string,
  offeringId: string,
  locationId: string,
  isAvailable: boolean,
): Promise<void> {
  await requireOk(
    ownerCall("PUT", `/orgs/${organizationId}/offerings/${offeringId}/locations/${locationId}`, {
      isAvailable,
    }),
    `offering location ${locationId}`,
  );
}

async function createSecondStore(
  organizationId: string,
  name: string,
): Promise<{ locationId: string; name: string }> {
  const second = await requireOk(
    ownerCall("POST", `/orgs/${organizationId}/locations`, {
      name,
      locationType: "STORE",
    }),
    "create second location",
  );
  const body = (await second.json()) as { data: { locationId: string; name: string } };
  return { locationId: body.data.locationId, name: body.data.name };
}

async function publishSalonService(
  organizationId: string,
  locationId: string,
): Promise<{ offeringId: string; variantId: string }> {
  const published = await publishOffering(organizationId, {
    kind: "SERVICE",
    name: SERVICE_NAME,
    slug: SERVICE_SLUG,
    kindDetails: {
      durationMinutes: 30,
      requiresResource: true,
      resourceTypeKeys: ["STYLIST"],
      bufferAfterMinutes: 0,
    },
    variants: [
      { name: "Default", price: { amount: SERVICE_PRICE, currency: "BDT" }, unitKey: "SESSION" },
    ],
  });
  await requireOk(
    ownerCall("POST", `/orgs/${organizationId}/resources`, {
      locationId,
      resourceTypeKey: "STYLIST",
      name: "Karim",
      capacity: 1,
      weeklySchedule: ALL_WEEKDAYS.map((weekday) => ({
        weekday,
        opensAt: "09:00",
        closesAt: "18:00",
      })),
      offeringIds: [published.offeringId],
    }),
    "create stylist",
  );
  return published;
}

async function seedSalon(): Promise<OrgWorld> {
  const organizationId = await createBusiness(SALON_SLUG, SALON_NAME, "SALON");
  const first = (await listLocations(organizationId))[0];
  if (first === undefined) throw new Error("salon has no location");
  const second = await createSecondStore(organizationId, LOC_TWO_NAME);
  await seedPublishedSite(stack, organizationId);
  await seedBranding(owner, organizationId, PNG_BYTES);
  await enableCheckout(organizationId);
  await patchSettings(organizationId, [
    { settingKey: BOOKING_MIN_NOTICE_MINUTES_SETTING_KEY, value: 0 },
    { settingKey: BOOKING_DEPOSIT_REQUIRED_SETTING_KEY, value: DEPOSIT_REQUIRED.FIXED },
    { settingKey: BOOKING_DEPOSIT_VALUE_SETTING_KEY, value: DEPOSIT_MINOR },
  ]);
  const published = await publishSalonService(organizationId, first.locationId);
  await setOfferingLocation(organizationId, published.offeringId, first.locationId, true);
  await setOfferingLocation(organizationId, published.offeringId, second.locationId, false);
  return {
    organizationId,
    locationId: first.locationId,
    locationName: first.name,
    locationTwoId: second.locationId,
    locationTwoName: second.name,
    offeringId: published.offeringId,
    variantId: published.variantId,
    slug: SERVICE_SLUG,
    home: `http://${SALON_SLUG}.${BASE_DOMAIN}:${STOREFRONT_PORT}`,
  };
}

async function seedGym(): Promise<OrgWorld> {
  const organizationId = await createBusiness(GYM_SLUG, GYM_NAME, "GYM");
  const existing = await listLocations(organizationId);
  const first = existing[0];
  if (first === undefined) throw new Error("gym has no location");
  await seedPublishedSite(stack, organizationId);
  await enableCheckout(organizationId);
  await enableCustomerLogin(owner, organizationId);
  await requireOk(
    ownerCall("POST", `/orgs/${organizationId}/custom-fields`, {
      entityType: "enrollment",
      fieldKey: "notes",
      label: { bn: "নোট", en: "Notes" },
      fieldType: "TEXT",
      isRequired: false,
      visibility: { admin: true, storefront: true, bot: false },
      botAsk: false,
      isSearchable: false,
      isSensitive: false,
      sortOrder: 20,
    }),
    "define enrollment notes",
  );
  const published = await publishOffering(organizationId, {
    kind: "PLAN",
    name: PLAN_NAME,
    slug: PLAN_SLUG,
    kindDetails: {
      billingPeriod: { unit: "MONTH", count: 1 },
      freezeAllowed: true,
      maxFreezeDaysPerYear: 30,
      startRule: "ANY_DATE",
      autoRenewDefault: false,
    },
    variants: [
      { name: "Monthly", price: { amount: PLAN_PRICE, currency: "BDT" }, unitKey: "SESSION" },
    ],
  });
  await setOfferingLocation(organizationId, published.offeringId, first.locationId, true);
  return {
    organizationId,
    locationId: first.locationId,
    locationName: first.name,
    locationTwoId: first.locationId,
    locationTwoName: first.name,
    offeringId: published.offeringId,
    variantId: published.variantId,
    slug: PLAN_SLUG,
    home: `http://${GYM_SLUG}.${BASE_DOMAIN}:${STOREFRONT_PORT}`,
  };
}

function dhakaYmd(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(date);
}

function addDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days));
  return next.toISOString().slice(0, 10);
}

interface PublicDay {
  readonly date: string;
  readonly slots: readonly { startsAt: string }[];
}

async function fetchPublicDays(
  organizationId: string,
  offeringId: string,
  variantId: string,
  locationId: string,
): Promise<readonly PublicDay[]> {
  const startDate = dhakaYmd(new Date());
  const endDate = addDays(startDate, 14);
  const params = new URLSearchParams({
    offeringId,
    variantId,
    locationId,
    startDate,
    endDate,
  });
  const response = await fetch(
    `${API_ORIGIN}/api/v1/storefront/orgs/${organizationId}/availability?${params.toString()}`,
  );
  if (!response.ok) {
    throw new Error(`availability answered ${response.status}: ${await response.text()}`);
  }
  const body = (await response.json()) as { data: { days: PublicDay[] } };
  return body.data.days;
}

function firstBusyDay(days: readonly PublicDay[]): { date: string; startsAt: string } {
  const found = days.find((day) => day.slots[0] !== undefined);
  const slot = found?.slots[0];
  if (found === undefined || slot === undefined) {
    throw new Error("the public API returned no free slots in the next 14 days");
  }
  return { date: found.date, startsAt: slot.startsAt };
}

function toResponseHeaders(rawHeaders: http.IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(rawHeaders)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
      continue;
    }
    headers.set(key, value);
  }
  return headers;
}

function fetchStorefront(
  path: string,
  options: { hostname: string; cookieHeader?: string },
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { Host: `${options.hostname}:${STOREFRONT_PORT}` };
    if (options.cookieHeader !== undefined) headers["Cookie"] = options.cookieHeader;
    const req = http.request(
      { hostname: "127.0.0.1", port: STOREFRONT_PORT, path, method: "GET", headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve(
            new Response(Buffer.concat(chunks), {
              status: res.statusCode ?? 200,
              statusText: res.statusMessage ?? "",
              headers: toResponseHeaders(res.headers),
            }),
          );
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function openPage(page: Page, home: string, path: string): Promise<void> {
  await page.goto(`${home}${path}`, { waitUntil: "load" });
}

async function waitForText(page: Page, text: string): Promise<void> {
  await page.waitForFunction(
    (wanted) => (document.querySelector("main")?.textContent ?? "").includes(wanted),
    { timeout: DEADLINE_MS, polling: POLL_MS },
    text,
  );
}

async function waitForTextGone(page: Page, text: string): Promise<void> {
  await page.waitForFunction(
    (wanted) => !(document.querySelector("main")?.textContent ?? "").includes(wanted),
    { timeout: DEADLINE_MS, polling: POLL_MS },
    text,
  );
}

async function waitForEnabledButton(page: Page, text: string): Promise<void> {
  await page.waitForFunction(
    (wanted) =>
      Array.from(document.querySelectorAll("button")).some(
        (button) =>
          (button.textContent ?? "").includes(wanted) &&
          !button.disabled &&
          Object.keys(button).some((key) => key.startsWith("__reactProps")),
      ),
    { timeout: DEADLINE_MS, polling: POLL_MS },
    text,
  );
}

async function clickButton(page: Page, text: string): Promise<void> {
  try {
    await waitForEnabledButton(page, text);
  } catch (error) {
    const body = await page.$eval("main", (main) => (main.textContent ?? "").slice(0, 800));
    throw new Error(`button "${text}" was not ready on ${page.url()}: ${body}`, { cause: error });
  }
  await page.click(`button::-p-text("${text}")`);
}

async function setValue(page: Page, selector: string, value: string): Promise<void> {
  await page.waitForSelector(selector, { timeout: DEADLINE_MS });
  await page.$eval(
    selector,
    (element, next) => {
      const nativeSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
      nativeSetter?.set?.call(element, next);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    },
    value,
  );
}

async function buttonHeight(page: Page, text: string): Promise<number> {
  return page.evaluate((wanted) => {
    const button = Array.from(document.querySelectorAll("button")).find((candidate) =>
      (candidate.textContent ?? "").includes(wanted),
    );
    return button?.getBoundingClientRect().height ?? 0;
  }, text);
}

async function selectLocation(page: Page, locationId: string): Promise<void> {
  await page.waitForSelector("#filter-location", { timeout: DEADLINE_MS });
  await page.select("#filter-location", locationId);
  await page.waitForFunction(
    (id) => window.location.search.includes(`location=${id}`),
    { timeout: DEADLINE_MS, polling: POLL_MS },
    locationId,
  );
}

async function openOffering(
  page: Page,
  home: string,
  slug: string,
  locationId: string,
): Promise<void> {
  const href = `/offerings/${slug}?location=${encodeURIComponent(locationId)}`;
  await openPage(page, home, href);
  await page.waitForSelector("button", { timeout: DEADLINE_MS });
}

async function waitForSlotOptions(page: Page): Promise<readonly string[]> {
  await page.waitForFunction(
    () => {
      const select = document.querySelector<HTMLSelectElement>("#booking-time");
      if (select === null || select.disabled) return false;
      return Array.from(select.options).some((option) => option.value.includes("T"));
    },
    { timeout: DEADLINE_MS, polling: POLL_MS },
  );
  return page.$eval("#booking-time", (select) =>
    Array.from((select as HTMLSelectElement).options)
      .map((option) => option.value)
      .filter((value) => value.includes("T")),
  );
}

async function proceedToCheckout(page: Page): Promise<void> {
  await waitForText(page, bnText.addedToCart);
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.click('a[href="/cart"]')]);
  await waitForEnabledButton(page, bnText.proceed);
  await clickButton(page, bnText.proceed);
  await page.waitForFunction(() => window.location.pathname === "/checkout", {
    timeout: DEADLINE_MS,
    polling: POLL_MS,
  });
  await page.waitForSelector("#checkout-name", { timeout: DEADLINE_MS });
}

async function fillContactAndSubmit(page: Page, phone: string): Promise<void> {
  await waitForEnabledButton(page, bnText.placeOrder);
  await setValue(page, "#checkout-name", GUEST_NAME);
  await setValue(page, "#checkout-phone", phone);
  await clickButton(page, bnText.placeOrder);
}

async function waitForReceipt(page: Page): Promise<string> {
  try {
    await page.waitForFunction(() => window.location.pathname.startsWith("/checkouts/"), {
      timeout: DEADLINE_MS,
      polling: POLL_MS,
    });
  } catch (error) {
    const body = await page.$eval("main", (main) => (main.textContent ?? "").slice(0, 800));
    throw new Error(`no receipt page after submit, still on ${page.url()}: ${body}`, {
      cause: error,
    });
  }
  await waitForText(page, bnText.receiptTitle);
  const pathname = await page.evaluate(() => window.location.pathname);
  const checkoutId = pathname.split("/").pop();
  if (checkoutId === undefined || checkoutId === "")
    throw new Error(`no checkout id in ${pathname}`);
  return checkoutId;
}

async function cookieHeaderOf(page: Page): Promise<string> {
  const cookies = await page.cookies();
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

async function assertReceiptCache(page: Page, world: OrgWorld, checkoutId: string): Promise<void> {
  await page.reload({ waitUntil: "load" });
  const hostname = new URL(world.home).hostname;
  const response = await fetchStorefront(
    `/api/v1/storefront/orgs/${world.organizationId}/checkouts/${checkoutId}`,
    { hostname, cookieHeader: await cookieHeaderOf(page) },
  );
  const cacheControl = (response.headers.get("cache-control") ?? "").toLowerCase();
  expect(cacheControl).toContain("private");
  expect(cacheControl).toContain("no-store");
}

async function signInInBrowser(page: Page, home: string, phone: string): Promise<void> {
  await openPage(page, home, "/sign-in");
  await page.waitForSelector("#sign-in-phone", { timeout: DEADLINE_MS });
  await page.type("#sign-in-phone", phone);
  const sentAfter = new Date();
  await page.click('button[type="submit"]');
  await page.waitForSelector("#sign-in-code", { timeout: DEADLINE_MS });
  const code = await latestSmsCode(stack, phone, sentAfter);
  await page.type("#sign-in-code", code);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "load" }),
    page.click('button[type="submit"]'),
  ]);
}

describe("the public storefront booking and enrollment flow", () => {
  it("opens the branded services page on the resolved host from a 360px Bangla phone", async () => {
    const context = await stack.browser.createBrowserContext();
    try {
      const page = await context.newPage();
      await page.setViewport(MOBILE_VIEWPORT);
      await openPage(page, salon.home, "/offerings?kind=SERVICE");
      await waitForText(page, SERVICE_NAME);

      const logoCount = await page.$$eval(`img[alt="${SALON_NAME}"]`, (images) => images.length);
      const brandColour = await page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--color-brand-primary").trim(),
      );
      expect(logoCount).toBeGreaterThan(0);
      expect(brandColour).toBe("#1f6f5c");

      const locationLabels = await page.$eval("#filter-location", (select) =>
        Array.from((select as HTMLSelectElement).options).map((option) => option.textContent ?? ""),
      );
      expect(locationLabels.some((label) => label.includes(salon.locationName))).toBe(true);
      expect(locationLabels.some((label) => label.includes(salon.locationTwoName))).toBe(true);

      await selectLocation(page, salon.locationId);
      await waitForText(page, SERVICE_NAME);
      await selectLocation(page, salon.locationTwoId);
      await waitForTextGone(page, SERVICE_NAME);

      await openOffering(page, salon.home, salon.slug, salon.locationId);
      await waitForText(page, SERVICE_NAME);
      const day = firstBusyDay(
        await fetchPublicDays(
          salon.organizationId,
          salon.offeringId,
          salon.variantId,
          salon.locationId,
        ),
      );
      await setValue(page, "#booking-date", day.date);
      const rendered = await waitForSlotOptions(page);
      const apiStarts = (
        await fetchPublicDays(
          salon.organizationId,
          salon.offeringId,
          salon.variantId,
          salon.locationId,
        )
      )
        .find((row) => row.date === day.date)
        ?.slots.map((slot) => slot.startsAt);
      expect(apiStarts?.length).toBeGreaterThan(0);
      expect(rendered).toEqual(apiStarts);
      expect(rendered.every((value) => value.includes("T"))).toBe(true);
      expect(await buttonHeight(page, bnText.bookNow)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);

      await Promise.all([
        page.waitForNavigation({ waitUntil: "load" }),
        page.click('a[href="/language?to=en"]'),
      ]);
      await openOffering(page, salon.home, salon.slug, salon.locationId);
      await waitForText(page, SERVICE_NAME);
      await setValue(page, "#booking-date", day.date);
      await waitForSlotOptions(page);
      await waitForEnabledButton(page, enBookNow);
      expect(await page.$eval("main", (main) => main.textContent ?? "")).toContain(enBookNow);
    } finally {
      await context.close();
    }
  }, 300_000);

  it("guest books a deposit-required service and a second phone no longer sees that slot", async () => {
    const context = await stack.browser.createBrowserContext();
    try {
      const page = await context.newPage();
      await page.setViewport(MOBILE_VIEWPORT);
      await openOffering(page, salon.home, salon.slug, salon.locationId);
      const day = firstBusyDay(
        await fetchPublicDays(
          salon.organizationId,
          salon.offeringId,
          salon.variantId,
          salon.locationId,
        ),
      );
      await setValue(page, "#booking-date", day.date);
      const before = await waitForSlotOptions(page);
      const heldStartsAt = before[0];
      if (heldStartsAt === undefined) throw new Error("the picker rendered no slot");
      await page.select("#booking-time", heldStartsAt);
      await clickButton(page, bnText.bookNow);
      await proceedToCheckout(page);
      await fillContactAndSubmit(page, GUEST_PHONE);
      const checkoutId = await waitForReceipt(page);
      const receipt = await page.$eval("main", (main) => main.textContent ?? "");
      expect(receipt).toContain("HELD");
      expect(receipt).toContain(bnText.paymentRequired);
      expect(receipt).not.toMatch(/BDT 0\.00/);
      await assertReceiptCache(page, salon, checkoutId);

      const other = await stack.browser.createBrowserContext();
      try {
        const second = await other.newPage();
        await second.setViewport(MOBILE_VIEWPORT);
        await openOffering(second, salon.home, salon.slug, salon.locationId);
        await setValue(second, "#booking-date", day.date);
        await second.waitForFunction(
          () => {
            const select = document.querySelector<HTMLSelectElement>("#booking-time");
            return select !== null && !select.disabled;
          },
          { timeout: DEADLINE_MS, polling: POLL_MS },
        );
        const remaining = await second.$eval("#booking-time", (select) =>
          Array.from((select as HTMLSelectElement).options).map((option) => option.value),
        );
        expect(remaining).not.toContain(heldStartsAt);
      } finally {
        await other.close();
      }
    } finally {
      await context.close();
    }
  }, 300_000);

  it("guest and signed-in plan requests stay PENDING and keep PLAN notes", async () => {
    const context = await stack.browser.createBrowserContext();
    try {
      const page = await context.newPage();
      await page.setViewport(MOBILE_VIEWPORT);
      await openOffering(page, gym.home, gym.slug, gym.locationId);
      expect(await buttonHeight(page, bnText.enrollNow)).toBeGreaterThanOrEqual(
        MIN_TOUCH_TARGET_PX,
      );
      await setValue(page, "#plan-notes", PLAN_NOTES);
      expect(await page.$eval("#plan-notes", (input) => (input as HTMLInputElement).value)).toBe(
        PLAN_NOTES,
      );
      await clickButton(page, bnText.enrollNow);
      await proceedToCheckout(page);
      await fillContactAndSubmit(page, GUEST_PHONE);
      const guestCheckoutId = await waitForReceipt(page);
      expect(await page.$eval("main", (main) => main.textContent ?? "")).toContain("PENDING");
      await assertReceiptCache(page, gym, guestCheckoutId);

      const signed = await stack.browser.createBrowserContext();
      try {
        const signedPage = await signed.newPage();
        await signedPage.setViewport(MOBILE_VIEWPORT);
        await signInInBrowser(signedPage, gym.home, CUSTOMER_PHONE);
        await openOffering(signedPage, gym.home, gym.slug, gym.locationId);
        expect(await buttonHeight(signedPage, bnText.enrollNow)).toBeGreaterThanOrEqual(
          MIN_TOUCH_TARGET_PX,
        );
        await setValue(signedPage, "#plan-notes", PLAN_NOTES);
        await clickButton(signedPage, bnText.enrollNow);
        await proceedToCheckout(signedPage);
        await fillContactAndSubmit(signedPage, CUSTOMER_PHONE);
        await waitForReceipt(signedPage);
        expect(await signedPage.$eval("main", (main) => main.textContent ?? "")).toContain(
          "PENDING",
        );
      } finally {
        await signed.close();
      }
    } finally {
      await context.close();
    }
  }, 300_000);
});
