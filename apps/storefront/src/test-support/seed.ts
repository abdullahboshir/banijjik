import { newId } from "@banijjik/ids";
import matrimonyBusiness from "./matrimony-business.json" with { type: "json" };
import {
  API_ORIGIN,
  STOREFRONT_ORIGIN,
  latestSmsCode,
  type StorefrontStack,
} from "./storefront-stack";

/**
 * Setup through the real API, so the browser test sees what a business and its customers see. Every call
 * sends the storefront origin, which the API lists as allowed.
 */
export interface Session {
  readonly cookieHeader: string;
  readonly name: string;
}

const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";
const PASSWORD = "correct-horse-battery";
const CUSTOMER_PHONE = "+8801712345678";
const LISTING_TEST_NAME = "Test Person";

interface CallOptions {
  readonly method?: string;
  readonly body?: unknown;
  readonly formData?: FormData;
  readonly cookieHeader?: string;
  readonly headers?: Record<string, string>;
}

function requestHeaders(options: CallOptions): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Origin: STOREFRONT_ORIGIN,
    [IDEMPOTENCY_KEY_HEADER]: newId(),
    ...(options.headers ?? {}),
  };
  if (options.cookieHeader) headers["Cookie"] = options.cookieHeader;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  return headers;
}

function requestBody(options: CallOptions): BodyInit | null {
  if (options.formData) return options.formData;
  return options.body === undefined ? null : JSON.stringify(options.body);
}

/** Calls the API under `/api/v1`, fails loudly with the body, and returns the parsed envelope and cookies. */
async function callApi<Data>(
  path: string,
  options: CallOptions = {},
): Promise<{ data: Data; setCookies: string[] }> {
  const method =
    options.method ?? (options.body === undefined && !options.formData ? "GET" : "POST");
  const response = await fetch(`${API_ORIGIN}/api/v1${path}`, {
    method,
    headers: requestHeaders(options),
    body: requestBody(options),
  });
  if (!response.ok) {
    throw new Error(`${method} ${path} answered ${response.status}: ${await response.text()}`);
  }
  const text = await response.text();
  const data = (text === "" ? {} : JSON.parse(text)) as { data: Data };
  return { data: data.data, setCookies: response.headers.getSetCookie() };
}

function cookieHeaderOf(setCookies: string[]): string {
  return setCookies.map((line) => line.split(";")[0] ?? "").join("; ");
}

/** A person who owns the test business: registered through the real API. */
export async function seedOwner(): Promise<Session> {
  const email = `owner-${newId().slice(-12)}@example.com`;
  const name = "রহিম উদ্দিন";
  const { setCookies } = await callApi("/auth/register", {
    body: { name, email, password: PASSWORD, preferredLocale: "bn" },
  });
  return { cookieHeader: cookieHeaderOf(setCookies), name };
}

/** The business with the matrimony template (directory and website modules on). */
export async function seedBusiness(owner: Session, slug: string, name: string): Promise<string> {
  await callApi("/me/orgs", {
    body: { ...matrimonyBusiness, name, slug },
    cookieHeader: owner.cookieHeader,
  });
  const { data } = await callApi<{ organizationId: string; slug: string }[]>("/me/orgs", {
    cookieHeader: owner.cookieHeader,
  });
  const found = data.find((organization) => organization.slug === slug);
  if (!found) throw new Error(`No business with slug ${slug}`);
  return found.organizationId;
}

/** Uploads a logo and sets it with the colours and the tagline (the branding of the profile). */
export async function seedBranding(
  owner: Session,
  organizationId: string,
  png: Uint8Array,
): Promise<void> {
  const form = new FormData();
  form.append("purpose", "LOGO");
  form.append("file", new Blob([Buffer.from(png)], { type: "image/png" }), "logo.png");
  const upload = await callApi<{ fileId: string }>(`/orgs/${organizationId}/files`, {
    formData: form,
    cookieHeader: owner.cookieHeader,
  });
  const profile = await callApi<{ version: number }>(`/orgs/${organizationId}/profile`, {
    cookieHeader: owner.cookieHeader,
  });
  await callApi(`/orgs/${organizationId}/profile`, {
    method: "PATCH",
    cookieHeader: owner.cookieHeader,
    body: {
      version: profile.data.version,
      branding: {
        logoFileId: upload.data.fileId,
        primaryColor: "#1F6F5C",
        accentColor: "#B45309",
        tagline: "Test tagline",
      },
    },
  });
}

/** Turns on customer sign-in: the business switches it on, the test inbox sends the codes. */
export async function enableCustomerLogin(owner: Session, organizationId: string): Promise<void> {
  await callApi(`/orgs/${organizationId}/settings`, {
    method: "PATCH",
    cookieHeader: owner.cookieHeader,
    body: { items: [{ settingKey: "contact.customerLogin", value: true }] },
  });
}

/** One published static page (About) in both languages. */
export async function publishAboutPage(owner: Session, organizationId: string): Promise<void> {
  const text = { bn: "আমাদের সম্পর্কে", en: "About us" };
  const body = { bn: "আমরা একটি পরীক্ষার প্রতিষ্ঠান।", en: "We are a test business." };
  await callApi(`/orgs/${organizationId}/website/pages/ABOUT`, {
    method: "PUT",
    cookieHeader: owner.cookieHeader,
    body: { title: text, body, isPublished: true, version: 0 },
  });
}

/** Signs a customer in through the storefront API with the code of the test inbox. */
export async function signInCustomer(
  stack: StorefrontStack,
  organizationId: string,
): Promise<Session> {
  await callApi(`/storefront/orgs/${organizationId}/auth/otp/send`, {
    body: { phone: CUSTOMER_PHONE },
  });
  const code = await latestSmsCode(stack, CUSTOMER_PHONE);
  const { data, setCookies } = await callApi<{ name: string | null }>(
    `/storefront/orgs/${organizationId}/auth/otp/verify`,
    { body: { phone: CUSTOMER_PHONE, code } },
  );
  return { cookieHeader: cookieHeaderOf(setCookies), name: data.name ?? LISTING_TEST_NAME };
}

interface FormField {
  readonly fieldKey: string;
  readonly fieldType: string;
  readonly isRequired: boolean;
  readonly options?: readonly string[];
}

const SAMPLE_BY_TYPE: Readonly<Record<string, unknown>> = {
  TEXT: "Test",
  LONG_TEXT: "Test",
  NUMBER: 25,
  DECIMAL: 25,
  BOOLEAN: true,
  DATE: "1995-05-01",
  PHONE: "+8801700000000",
  EMAIL: "test@example.com",
  URL: "https://example.com",
};

/** A value for a field the form requires: the first option of a choice, a sample of any other type. */
function sampleValue(field: FormField): unknown {
  if (field.fieldType === "SELECT") return field.options?.[0];
  if (field.fieldType === "MULTI_SELECT") return [field.options?.[0]];
  return SAMPLE_BY_TYPE[field.fieldType];
}

/** The customer's listing, submitted with every consent, then approved by the owner (a real review). */
export async function seedApprovedListing(
  owner: Session,
  customer: Session,
  organizationId: string,
): Promise<{ listingNumber: string }> {
  const form = await callApi<{ fields: FormField[] }>(
    `/storefront/orgs/${organizationId}/directory/form`,
  );
  const customFields: Record<string, unknown> = {};
  for (const field of form.data.fields) {
    const value = sampleValue(field);
    if (field.isRequired && value !== undefined) customFields[field.fieldKey] = value;
  }
  customFields["gender"] ??= form.data.fields.find((field) => field.fieldKey === "gender")
    ?.options?.[0];
  const draft = await callApi<{ listingId: string; version: number }>(
    `/storefront/orgs/${organizationId}/my/listing`,
    {
      method: "PUT",
      cookieHeader: customer.cookieHeader,
      body: { customFields },
    },
  );
  const config = await callApi<{ consents: { consentKey: string }[] }>(
    `/orgs/${organizationId}/directory/config`,
    {
      cookieHeader: owner.cookieHeader,
    },
  );
  const submitted = await callApi<{ listingId: string; version: number }>(
    `/storefront/orgs/${organizationId}/my/listing/submit`,
    {
      method: "POST",
      cookieHeader: customer.cookieHeader,
      body: {
        consents: config.data.consents.map((consent) => ({ consentKey: consent.consentKey })),
      },
    },
  );
  const approved = await callApi<{ listingNumber: string }>(
    `/orgs/${organizationId}/directory/listings/${draft.data.listingId}/approve`,
    { method: "POST", cookieHeader: owner.cookieHeader, body: { version: submitted.data.version } },
  );
  return { listingNumber: approved.data.listingNumber };
}
