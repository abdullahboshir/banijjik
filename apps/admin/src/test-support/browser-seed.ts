import { INDUSTRY_TEMPLATE_STATUS } from "@banijjik/contracts";
import { MongoClient } from "mongodb";
import { callApi, organizationIdOf, type BrowserStack, type SeededPerson } from "./browser-stack";

/** Creates and publishes a bookable SERVICE through the real API, so a booking test starts from a known service. */
export async function seedBookableService(
  person: SeededPerson,
  slug: string,
  input: { readonly name: string; readonly durationMinutes: number },
): Promise<{ offeringId: string; variantId: string }> {
  const organizationId = await organizationIdOf(person, slug);
  const created = await callApi(`/orgs/${organizationId}/offerings`, {
    cookies: person.cookies,
    body: {
      kind: "SERVICE",
      name: input.name,
      kindDetails: {
        durationMinutes: input.durationMinutes,
        requiresResource: true,
        resourceTypeKeys: ["STYLIST"],
        bufferAfterMinutes: 0,
      },
      variants: [
        { name: "Default", price: { amount: 50000, currency: "BDT" }, unitKey: "SESSION" },
      ],
    },
  });
  // Safe: the API answers with the { data: OfferingResponse } envelope (14 section 4).
  const offering = (await created.json()) as {
    data: { offeringId: string; version: number; variants: { variantId: string }[] };
  };
  await callApi(`/orgs/${organizationId}/offerings/${offering.data.offeringId}/publish`, {
    cookies: person.cookies,
    body: { version: offering.data.version },
  });
  return {
    offeringId: offering.data.offeringId,
    variantId: offering.data.variants[0]?.variantId as string,
  };
}

/**
 * Marks a seeded template PUBLISHED in the stack's platform database. Signup accepts a published
 * template only (ADR-075), and the browser stack signs in business owners, not a platform admin
 * who could publish through the platform API.
 */
export async function publishTemplate(stack: BrowserStack, templateKey: string): Promise<void> {
  const client = await MongoClient.connect(stack.mongoUri);
  try {
    await client
      .db("browser_platform")
      .collection("industry_templates")
      .updateOne(
        // A seeded-template field name in a DB filter, not a branch on industry (ADR-033).
        { ["industryTemplateKey"]: templateKey },
        { $set: { status: INDUSTRY_TEMPLATE_STATUS.PUBLISHED } },
      );
  } finally {
    await client.close();
  }
}

/** Creates and publishes a one-month PLAN through the real API, so an enrollment test starts from a known plan. */
export async function seedMonthlyPlan(
  person: SeededPerson,
  slug: string,
  input: { readonly name: string; readonly priceMinor: number },
): Promise<{ offeringId: string; variantId: string }> {
  const organizationId = await organizationIdOf(person, slug);
  const created = await callApi(`/orgs/${organizationId}/offerings`, {
    cookies: person.cookies,
    body: {
      kind: "PLAN",
      name: input.name,
      kindDetails: { billingPeriod: { unit: "MONTH", count: 1 }, freezeAllowed: true },
      variants: [
        {
          name: "Monthly",
          price: { amount: input.priceMinor, currency: "BDT" },
          unitKey: "SESSION",
        },
      ],
    },
  });
  // Safe: the API answers with the { data: OfferingResponse } envelope (14 section 4).
  const offering = (await created.json()) as {
    data: { offeringId: string; version: number; variants: { variantId: string }[] };
  };
  await callApi(`/orgs/${organizationId}/offerings/${offering.data.offeringId}/publish`, {
    cookies: person.cookies,
    body: { version: offering.data.version },
  });
  return {
    offeringId: offering.data.offeringId,
    variantId: offering.data.variants[0]?.variantId as string,
  };
}

/**
 * Adds a member contact through the real API. The GYM template requires an emergency phone on every
 * customer, so an inline contact from a sheet is refused there and the test picks a saved one.
 */
export async function seedMember(
  person: SeededPerson,
  slug: string,
  input: { readonly name: string; readonly phone: string; readonly emergencyPhone: string },
): Promise<void> {
  const organizationId = await organizationIdOf(person, slug);
  await callApi(`/orgs/${organizationId}/contacts`, {
    cookies: person.cookies,
    body: {
      contactType: "PERSON",
      name: input.name,
      phoneE164: input.phone,
      contactRoles: ["CUSTOMER"],
      customFields: { emergency_contact: input.emergencyPhone },
    },
  });
}

/** Creates and publishes a bookable EVENT through the real API, so a session test starts from a known event. */
export async function seedBookableEvent(
  person: SeededPerson,
  slug: string,
  input: { readonly name: string },
): Promise<{ offeringId: string; variantId: string }> {
  const organizationId = await organizationIdOf(person, slug);
  const created = await callApi(`/orgs/${organizationId}/offerings`, {
    cookies: person.cookies,
    body: {
      kind: "EVENT",
      name: input.name,
      kindDetails: { salesCloseMinutesBefore: 0, allowWaitlist: false },
      variants: [{ name: "Default", price: { amount: 30000, currency: "BDT" }, unitKey: "PIECE" }],
    },
  });
  // Safe: the API answers with the { data: OfferingResponse } envelope (14 section 4).
  const offering = (await created.json()) as {
    data: { offeringId: string; version: number; variants: { variantId: string }[] };
  };
  await callApi(`/orgs/${organizationId}/offerings/${offering.data.offeringId}/publish`, {
    cookies: person.cookies,
    body: { version: offering.data.version },
  });
  return {
    offeringId: offering.data.offeringId,
    variantId: offering.data.variants[0]?.variantId as string,
  };
}
