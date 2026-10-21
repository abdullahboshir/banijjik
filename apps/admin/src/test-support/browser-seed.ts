import { INDUSTRY_TEMPLATE_STATUS } from "@banijjik/contracts";
import { MongoClient } from "mongodb";
import { callApi, organizationIdOf, type BrowserStack, type SeededPerson } from "./browser-stack";

/**
 * Creates and publishes a bookable SERVICE through the real API. The offering editor saves no
 * `requiresResource`, and only offerings with it are bookable (the booking sheet lists those), so a
 * browser test that books cannot make the service through the UI yet.
 */
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
