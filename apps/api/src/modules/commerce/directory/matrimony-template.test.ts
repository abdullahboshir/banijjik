import { SEED_INDUSTRY_TEMPLATE_KEY } from "@banijjik/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerIamApiModels, startIamApi } from "../../../../test-support/iam-api-harness.js";
import type { IamApiHarness } from "../../../../test-support/iam-api-harness.js";
import { enableDirectoryForWorld } from "../../../../test-support/directory-world.js";
import {
  asCustomerCookies,
  callStorefront,
  enableCustomerLogin,
  signInCustomer,
} from "../../../../test-support/storefront-world.js";
import {
  createTwoOrganizations,
  type TwoOrganizations,
} from "../../../../test-support/two-organizations.js";

// A real app with the production v1 router: the listing fields and the directory block are read
// from the seeded industry_templates rows, exactly as an operator would publish them (ADR-034).
registerIamApiModels();

const ISLAMIC = SEED_INDUSTRY_TEMPLATE_KEY.MATRIMONY_ISLAMIC;
const GENERAL = SEED_INDUSTRY_TEMPLATE_KEY.MATRIMONY;
const MS_PER_DAY = 86_400_000;

let harness: IamApiHarness;

beforeAll(async () => {
  harness = await startIamApi();
  await publishTemplate(ISLAMIC);
  await publishTemplate(GENERAL);
});

afterAll(async () => {
  await harness.dispose();
});

async function publishTemplate(industryTemplateKey: string): Promise<void> {
  // $inc on version busts the cached reader (ADR-101). Signup only accepts a PUBLISHED template.
  await harness.connections.platform
    .collection("industry_templates")
    .updateOne(
      { industryTemplateKey },
      { $set: { status: "PUBLISHED" }, $inc: { version: 1 } },
    );
}

async function aMatrimonyWorld(industryTemplateKey: string): Promise<TwoOrganizations> {
  const world = await createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey,
  });
  await enableCustomerLogin(world, world.organizationA);
  await enableDirectoryForWorld(world);
  return world;
}

function minusEighteenYears(now: Date): Date {
  const born = new Date(now);
  born.setUTCFullYear(born.getUTCFullYear() - 18);
  return born;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// A birth date exactly 18 years before the fixed clock date (whole years, so the age is 18 today).
function adultDob(): string {
  return isoDate(minusEighteenYears(harness.clock.now()));
}

// One day later than the adult birth date: the eighteenth birthday has not arrived yet (age 17).
function childDob(): string {
  return isoDate(new Date(minusEighteenYears(harness.clock.now()).getTime() + MS_PER_DAY));
}

const ISLAMIC_CONSENTS = [
  "truthful",
  "guardian_consent",
  "adult_age",
  "terms_accepted",
  "islamic_eligibility",
];
const GENERAL_CONSENTS = ["truthful", "guardian_consent", "adult_age", "terms_accepted"];

function biodataFields(input: {
  readonly dob: string;
  readonly guardianPhone: string;
}): Record<string, unknown> {
  return {
    gender: "MALE",
    date_of_birth: input.dob,
    marital_status: "NEVER_MARRIED",
    permanent_address: { divisionKey: "dhaka", districtKey: "dhaka" },
    education_method: "GENERAL",
    highest_education: "BACHELORS",
    profession: "DOCTOR",
    daily_prayers: "FIVE_TIME",
    quran_recitation: "WITH_MEANING",
    guardian_name: "Abdul Karim",
    guardian_relationship: "FATHER",
    guardian_phone: input.guardianPhone,
    full_name: "Rahim Uddin",
    grew_up_in: "Dhaka",
    institution: "University of Dhaka",
    own_phone: "+8801911223344",
  };
}

type StorefrontResponse = Awaited<ReturnType<typeof callStorefront>>;

async function saveListing(
  world: TwoOrganizations,
  cookies: Record<string, string>,
  customFields: Record<string, unknown>,
): Promise<StorefrontResponse> {
  return callStorefront(harness.app, {
    method: "put",
    organizationId: world.organizationA,
    suffix: "/my/listing",
    cookies,
    body: { customFields },
  });
}

async function submitListing(
  world: TwoOrganizations,
  cookies: Record<string, string>,
  consentKeys: readonly string[],
): Promise<StorefrontResponse> {
  return callStorefront(harness.app, {
    method: "post",
    organizationId: world.organizationA,
    suffix: "/my/listing/submit",
    cookies,
    body: { consents: consentKeys.map((consentKey) => ({ consentKey })) },
  });
}

async function approveOldestSubmitted(world: TwoOrganizations): Promise<void> {
  const queue = await world.alice.call(
    "get",
    `/orgs/${world.organizationA}/directory/queue?status=SUBMITTED`,
  );
  const row = queue.body.data.items[0] as { listingId: string; version: number };
  const approved = await world.alice.call(
    "post",
    `/orgs/${world.organizationA}/directory/listings/${row.listingId}/approve`,
    { version: row.version },
  );
  expect(approved.status).toBe(200);
}

describe("matrimony templates on the directory API", () => {
  it("submits a complete islamic biodata and a staff member approves it", async () => {
    const world = await aMatrimonyWorld(ISLAMIC);
    const customer = await signInCustomer(harness, world.organizationA);
    const cookies = asCustomerCookies(customer.session);

    const saved = await saveListing(world, cookies, {
      ...biodataFields({ dob: adultDob(), guardianPhone: "+8801799887766" }),
    });
    expect(saved.status).toBe(200);
    expect(saved.body.data?.status).toBe("DRAFT");

    const submitted = await submitListing(world, cookies, ISLAMIC_CONSENTS);
    expect(submitted.status).toBe(200);
    expect(submitted.body.data?.status).toBe("SUBMITTED");

    await approveOldestSubmitted(world);
  });

  it("refuses a date of birth under 18 and accepts the eighteenth birthday edge", async () => {
    const world = await aMatrimonyWorld(ISLAMIC);

    const child = await signInCustomer(harness, world.organizationA);
    const childCookies = asCustomerCookies(child.session);
    await saveListing(world, childCookies, {
      ...biodataFields({ dob: childDob(), guardianPhone: "+8801799887766" }),
    });
    const refused = await submitListing(world, childCookies, ISLAMIC_CONSENTS);
    expect(refused.status).toBe(400);
    expect(refused.body.error?.messageKey).toBe("errors.directory_under_min_age");

    const adult = await signInCustomer(harness, world.organizationA);
    const adultCookies = asCustomerCookies(adult.session);
    await saveListing(world, adultCookies, {
      ...biodataFields({ dob: adultDob(), guardianPhone: "+8801799880011" }),
    });
    const accepted = await submitListing(world, adultCookies, ISLAMIC_CONSENTS);
    expect(accepted.status).toBe(200);
  });

  it("refuses a guardian phone equal to the account phone", async () => {
    const world = await aMatrimonyWorld(ISLAMIC);
    const customer = await signInCustomer(harness, world.organizationA);
    const cookies = asCustomerCookies(customer.session);
    const accountPhoneE164 = `+88${customer.phone}`;

    await saveListing(world, cookies, {
      ...biodataFields({ dob: adultDob(), guardianPhone: accountPhoneE164 }),
    });
    const refused = await submitListing(world, cookies, ISLAMIC_CONSENTS);
    expect(refused.status).toBe(400);
    expect(refused.body.error?.messageKey).toBe("errors.directory_phone_must_differ");
  });

  it("refuses a submit without every consent", async () => {
    const world = await aMatrimonyWorld(ISLAMIC);
    const customer = await signInCustomer(harness, world.organizationA);
    const cookies = asCustomerCookies(customer.session);

    await saveListing(world, cookies, {
      ...biodataFields({ dob: adultDob(), guardianPhone: "+8801799887766" }),
    });
    const refused = await submitListing(world, cookies, [
      "truthful",
      "guardian_consent",
      "terms_accepted",
      "islamic_eligibility",
    ]);
    expect(refused.status).toBe(400);
    expect(refused.body.error?.messageKey).toBe("errors.directory_consent_required");
  });

  it("a public search filters by gender, district and age and returns only PUBLIC fields", async () => {
    const world = await aMatrimonyWorld(ISLAMIC);
    const owner = await signInCustomer(harness, world.organizationA);
    await saveListing(world, asCustomerCookies(owner.session), {
      ...biodataFields({ dob: adultDob(), guardianPhone: "+8801799887766" }),
    });
    await submitListing(world, asCustomerCookies(owner.session), ISLAMIC_CONSENTS);
    await approveOldestSubmitted(world);

    const hit = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/listings",
      query: {
        "f.gender": "MALE",
        "f.permanent_address.districtKey": "dhaka",
        "f.date_of_birth.ageMin": "20",
        "f.date_of_birth.ageMax": "40",
      },
    });
    expect(hit.status).toBe(200);
    expect(hit.body.data.items).toHaveLength(1);
    const fields = hit.body.data.items[0].customFields as Record<string, unknown>;
    expect(fields.gender).toBe("MALE");
    expect(fields.permanent_address).toEqual({ divisionKey: "dhaka", districtKey: "dhaka" });
    expect(fields).not.toHaveProperty("grew_up_in");
    expect(fields).not.toHaveProperty("guardian_phone");
    expect(fields).not.toHaveProperty("full_name");

    const miss = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/listings",
      query: { "f.gender": "FEMALE" },
    });
    expect(miss.body.data.items).toEqual([]);
  });

  it("a signed-in visitor also gets MEMBERS fields but never UNLOCKED or PRIVATE ones", async () => {
    const world = await aMatrimonyWorld(ISLAMIC);
    const owner = await signInCustomer(harness, world.organizationA);
    await saveListing(world, asCustomerCookies(owner.session), {
      ...biodataFields({ dob: adultDob(), guardianPhone: "+8801799887766" }),
    });
    await submitListing(world, asCustomerCookies(owner.session), ISLAMIC_CONSENTS);
    await approveOldestSubmitted(world);

    const visitor = await signInCustomer(harness, world.organizationA);
    const member = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/listings",
      cookies: asCustomerCookies(visitor.session),
    });
    expect(member.status).toBe(200);
    expect(member.body.data.items).toHaveLength(1);
    const fields = member.body.data.items[0].customFields as Record<string, unknown>;
    expect(fields.grew_up_in).toBe("Dhaka");
    expect(fields.institution).toBe("University of Dhaka");
    expect(fields).not.toHaveProperty("guardian_name");
    expect(fields).not.toHaveProperty("guardian_phone");
    expect(fields).not.toHaveProperty("full_name");
    expect(fields).not.toHaveProperty("own_phone");
  });

  it("the review queue's rejection reasons are the seeded ones", async () => {
    const world = await aMatrimonyWorld(ISLAMIC);
    const config = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/directory/config`,
    );
    expect(config.status).toBe(200);
    expect(config.body.data.rejectionReasons.map((r: { reasonKey: string }) => r.reasonKey)).toEqual([
      "guardian_consent_missing",
      "own_number_in_guardian_field",
      "unclear_answers",
      "false_information",
      "incomplete",
    ]);
    expect(
      config.body.data.rejectionReasons.find((r: { reasonKey: string }) => r.reasonKey === "false_information").isFinal,
    ).toBe(true);
    expect(config.body.data.sections.map((s: { sectionKey: string }) => s.sectionKey)).toContain(
      "religious",
    );
  });

  it("the general template submits a biodata, returns PUBLIC fields and has no religious section", async () => {
    const world = await aMatrimonyWorld(GENERAL);
    const owner = await signInCustomer(harness, world.organizationA);
    const cookies = asCustomerCookies(owner.session);
    const generalFields = biodataFields({ dob: adultDob(), guardianPhone: "+8801799887766" });
    delete generalFields.daily_prayers;
    delete generalFields.quran_recitation;

    await saveListing(world, cookies, generalFields);
    const submitted = await submitListing(world, cookies, GENERAL_CONSENTS);
    expect(submitted.status).toBe(200);
    await approveOldestSubmitted(world);

    const anon = await callStorefront(harness.app, {
      method: "get",
      organizationId: world.organizationA,
      suffix: "/listings",
    });
    expect(anon.status).toBe(200);
    expect(anon.body.data.items).toHaveLength(1);
    const fields = anon.body.data.items[0].customFields as Record<string, unknown>;
    expect(fields.profession).toBe("DOCTOR");
    expect(fields).not.toHaveProperty("grew_up_in");

    const config = await world.alice.call(
      "get",
      `/orgs/${world.organizationA}/directory/config`,
    );
    expect(config.body.data.sections.map((s: { sectionKey: string }) => s.sectionKey)).not.toContain(
      "religious",
    );
    expect(
      config.body.data.consents.map((c: { consentKey: string }) => c.consentKey),
    ).not.toContain("islamic_eligibility");
  });
});
