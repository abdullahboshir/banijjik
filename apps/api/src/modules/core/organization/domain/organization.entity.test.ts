import { newId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { DomainRuleError } from "./errors.js";
import { Organization, type NewOrganizationInput } from "./organization.entity.js";

const NOW = new Date("2026-10-11T08:00:00.000Z");

function anOrganizationInput(overrides: Partial<NewOrganizationInput> = {}): NewOrganizationInput {
  return {
    name: "Rahim Store",
    slug: "rahim-store",
    industryTemplateKey: "RETAIL",
    ownerUserId: newId() as UserId,
    defaultLocale: "bn",
    now: NOW,
    ...overrides,
  };
}

function messageKeyOf(action: () => unknown): string | undefined {
  try {
    action();
  } catch (error) {
    return error instanceof DomainRuleError ? error.messageKey : undefined;
  }
  return undefined;
}

function firstFieldOf(action: () => unknown): { path: string; messageKey: string } | undefined {
  try {
    action();
  } catch (error) {
    if (!(error instanceof DomainRuleError)) return undefined;
    // Safe: invalidField() always builds details.fields in this shape.
    const fields = error.details?.["fields"] as { path: string; messageKey: string }[] | undefined;
    return fields?.[0];
  }
  return undefined;
}

describe("Organization.create", () => {
  it("starts active on the shared database with the Bangladesh defaults and the caller as owner", () => {
    const ownerUserId = newId() as UserId;

    const organization = Organization.create(anOrganizationInput({ ownerUserId }));

    expect(organization).toMatchObject({
      slug: "rahim-store",
      name: "Rahim Store",
      industryTemplateKey: "RETAIL",
      ownerUserId,
      createdByUserId: ownerUserId,
      status: "ACTIVE",
      deployment: "SHARED",
      countryCode: "BD",
      currencyCode: "BDT",
      timezone: "Asia/Dhaka",
      defaultLocale: "bn",
      configVersion: 1,
      version: 1,
    });
    expect(organization.organizationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("trims the name and normalizes the slug", () => {
    const organization = Organization.create(
      anOrganizationInput({ name: "  Rahim Store ", slug: "  Rahim-Store " }),
    );

    expect(organization.name).toBe("Rahim Store");
    expect(organization.slug).toBe("rahim-store");
  });

  it("rejects a name shorter than 2 or longer than 80 characters", () => {
    expect(firstFieldOf(() => Organization.create(anOrganizationInput({ name: " a " })))).toEqual({
      path: "name",
      messageKey: "validation.name_length",
    });
    expect(
      messageKeyOf(() => Organization.create(anOrganizationInput({ name: "x".repeat(81) }))),
    ).toBe("errors.validation_error");
  });

  it("rejects a slug that breaks the format rules", () => {
    for (const slug of ["ab", "rahim--store", "-rahim", "rahim-", "রহিম-স্টোর", "rahim_store"]) {
      expect(firstFieldOf(() => Organization.create(anOrganizationInput({ slug })))).toEqual({
        path: "slug",
        messageKey: "validation.slug_invalid",
      });
    }
  });

  it("rejects a reserved slug", () => {
    expect(firstFieldOf(() => Organization.create(anOrganizationInput({ slug: "Admin" })))).toEqual(
      {
        path: "slug",
        messageKey: "validation.slug_reserved",
      },
    );
  });
});
