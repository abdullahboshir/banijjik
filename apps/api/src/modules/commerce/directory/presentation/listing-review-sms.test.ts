import { CUSTOM_FIELD_TYPE } from "@banijjik/contracts";
import { DIRECTORY_EVENT_TYPE } from "@banijjik/contracts/directory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EventHandlerRegistry } from "../../../../kernel/events/event-handler-registry.js";
import {
  runEventHandler,
  type HandlerRunResult,
} from "../../../../kernel/events/handler-runner.js";
import { buildReviewResultMessageComposer } from "../../../../routes/directory-event-handlers.js";
import { buildModuleRegistry } from "../../../../routes/module-registry.js";
import {
  buildOrganizationConfigPorts,
  buildResolvedConfigSources,
} from "../../../../routes/organization-config-ports.js";
import { buildSettingsResolver } from "../../../core/settings/index.js";
import { buildOrgConfigService } from "../../../platform/entitlement/index.js";
import { buildDirectoryBlockReader } from "../../../platform/industry/index.js";
import {
  registerIamApiModels,
  startIamApi,
  type IamApiHarness,
} from "../../../../test-support/iam-api-harness.js";
import { enableDirectoryForWorld } from "../../../../test-support/directory-world.js";
import { ContractTemplateReader } from "../../../../test-support/module-contract/contract-template-reader.js";
import {
  asCustomerCookies,
  callStorefront,
  enableCustomerLogin,
  readInbox,
  signInCustomer,
} from "../../../../test-support/storefront-world.js";
import {
  createTwoOrganizations,
  type TwoOrganizations,
} from "../../../../test-support/two-organizations.js";
import { buildCustomerSmsNotifier } from "../../../commerce/contact/index.js";
import { SMS_PURPOSE } from "@banijjik/contracts/sms";
import { buildGatewaySmsSender } from "../../../integration/sms/index.js";
import { startSmsStub } from "../../../../test-support/sms-http-stub.js";
import { createPlatformActor } from "../../../../test-support/platform-world.js";
import { PLATFORM_ROLE } from "@banijjik/contracts";
import {
  buildNotifyReviewResultHandler,
  directorySettingsFromResolver,
  MongoListingRepository,
} from "../index.js";

registerIamApiModels();

const templateReader = new ContractTemplateReader();
let harness: IamApiHarness;
let smsStub: Awaited<ReturnType<typeof startSmsStub>>;

beforeAll(async () => {
  smsStub = await startSmsStub((request) => {
    if (request.url === "/auth/tokens") return { body: { token: "review-gateway-token" } };
    return { body: { response_code: 202 } };
  });
  // `tenantRouters: []` makes the harness build the real v1 router with this permissive template.
  harness = await startIamApi({
    templateReader,
    tenantRouters: [],
    environmentOverrides: {
      SMS_ADAREACH_BASE_URL: smsStub.baseUrl,
      SMS_BULKSMSBD_BASE_URL: smsStub.baseUrl,
    },
  });
});

afterAll(async () => {
  await harness.dispose();
  await smsStub.close();
});

const DIRECTORY_BLOCK = {
  sections: [{ sectionKey: "basics", label: { bn: "মূল", en: "Basics" } }],
  consents: [{ consentKey: "truthful", text: { bn: "সত্য", en: "Truthful" } }],
  rejectionReasons: [
    { reasonKey: "unclear", label: { bn: "অস্পষ্ট", en: "Unclear" }, isFinal: false },
  ],
  listingNumberPrefix: "BD",
};

const STAFF_ONLY_NOTE = "staff only remark";

async function seedDirectoryBlock(organizationId: string, block: object): Promise<void> {
  const org = await harness.connections.platform
    .collection("organizations")
    .findOne({ organizationId });
  if (org === null) throw new Error("organization missing");
  await harness.connections.platform
    .collection("industry_templates")
    .updateOne(
      { industryTemplateKey: org["industryTemplateKey"] as string },
      { $set: { "configuration.directory": block }, $inc: { version: 1 } },
    );
}

/** A business with a directory, customer sign-in and one required listing field. */
async function aDirectoryWorld(): Promise<TwoOrganizations> {
  const world = await createTwoOrganizations(harness.app, harness.connections, {
    industryTemplateKey: "RETAIL",
  });
  await enableCustomerLogin(world, world.organizationA);
  await enableDirectoryForWorld(world);
  await seedDirectoryBlock(world.organizationA, DIRECTORY_BLOCK);
  const field = await world.alice.call("post", `/orgs/${world.organizationA}/custom-fields`, {
    entityType: "listing",
    fieldKey: "age_band",
    fieldType: CUSTOM_FIELD_TYPE.TEXT,
    label: { bn: "বয়স", en: "Age band" },
    isRequired: true,
    visibility: { admin: true, storefront: true, bot: false },
    botAsk: false,
    isSearchable: false,
    isSensitive: false,
    sortOrder: 1,
    listingTier: "PUBLIC",
  });
  if (field.status !== 201) throw new Error(`custom field failed: ${field.status}`);
  return world;
}

interface ReviewSubject {
  readonly phone: string;
  readonly listingId: string;
  readonly listingNumber: string;
  readonly customerAccountId: string;
}

/** A customer's listing, submitted and then approved or rejected by staff. */
async function reviewedListing(
  world: TwoOrganizations,
  outcome: "APPROVED" | "REJECTED",
  note?: string,
): Promise<ReviewSubject> {
  const organizationId = world.organizationA;
  const customer = await signInCustomer(harness, organizationId);
  const cookies = asCustomerCookies(customer.session);
  const draft = await callStorefront(harness.app, {
    method: "put",
    organizationId,
    suffix: "/my/listing",
    cookies,
    body: { customFields: { age_band: "25" } },
  });
  if (draft.status !== 200) throw new Error(`draft failed: ${JSON.stringify(draft.body)}`);
  const listingId = draft.body.data.listingId as string;
  const submitted = await callStorefront(harness.app, {
    method: "post",
    organizationId,
    suffix: "/my/listing/submit",
    cookies,
    body: { consents: [{ consentKey: "truthful" }] },
  });
  if (submitted.status !== 200) throw new Error(`submit failed: ${JSON.stringify(submitted.body)}`);
  const path = `/orgs/${organizationId}/directory/listings/${listingId}`;
  const version = submitted.body.data.version as number;
  const review =
    outcome === "APPROVED"
      ? await world.alice.call("post", `${path}/approve`, { version })
      : await world.alice.call("post", `${path}/reject`, {
          version,
          reasonKeys: ["unclear"],
          ...(note === undefined ? {} : { note }),
        });
  if (review.status !== 200) throw new Error(`review failed: ${JSON.stringify(review.body)}`);
  return {
    phone: customer.phone,
    listingId,
    listingNumber: review.body.data.listingNumber as string,
    customerAccountId: review.body.data.ownerCustomerAccountId as string,
  };
}

interface ReviewEvent {
  readonly eventId: string;
  readonly type: string;
}

async function newestReviewEvent(organizationId: string, eventType: string): Promise<ReviewEvent> {
  const event = (await harness.connections.platform
    .collection("outbox_events")
    .find({ organizationId, type: eventType })
    .sort({ createdAt: -1 })
    .limit(1)
    .next()) as ReviewEvent | null;
  if (event === null) throw new Error(`the ${eventType} event is missing`);
  return event;
}

/** The production handler over the real settings and contact adapters. */
function reviewRegistry(
  options: {
    readonly smsDriver?: "test-inbox" | "disabled" | "gateway";
    readonly sender?: { send(message: { phoneE164: string; text: string }): Promise<void> };
    readonly gatewaySender?: {
      send(message: {
        phoneE164: string;
        text: string;
        purpose: typeof SMS_PURPOSE.LISTING_REVIEW_RESULT;
      }): Promise<void>;
    };
  } = {},
): EventHandlerRegistry {
  const modules = buildModuleRegistry();
  const orgConfig = buildOrgConfigService({
    registry: modules,
    clock: harness.clock,
    ...buildOrganizationConfigPorts(),
    ...buildResolvedConfigSources(modules),
    // The template the harness gives the request path, so the effective modules match (M.8b).
    templates: templateReader,
  });
  const registry = new EventHandlerRegistry();
  registry.register(
    buildNotifyReviewResultHandler({
      listings: new MongoListingRepository(),
      settings: directorySettingsFromResolver(
        buildSettingsResolver({ orgConfig, manifests: modules.all() }),
      ),
      notifier: buildCustomerSmsNotifier({
        smsDriver: options.smsDriver ?? "test-inbox",
        clock: harness.clock,
        ...(options.gatewaySender === undefined
          ? {}
          : { sender: { send: options.gatewaySender.send.bind(options.gatewaySender) } }),
        ...(options.sender === undefined ? {} : { sender: options.sender }),
      }),
      composer: buildReviewResultMessageComposer(buildDirectoryBlockReader()),
    }),
  );
  return registry;
}

async function runReview(
  registry: EventHandlerRegistry,
  organizationId: string,
  eventType: string,
  isEffective = true,
): Promise<HandlerRunResult> {
  const event = await newestReviewEvent(organizationId, eventType);
  return runEventHandler(
    {
      eventId: event.eventId,
      handlerKey: "directory.notifyReviewResult",
      type: event.type,
      organizationId,
    },
    registry,
    { isEffective: async () => isEffective },
  );
}

/** Only the review SMS: the sign-in code message of the same phone must not be counted. */
async function reviewTexts(organizationId: string, subject: ReviewSubject): Promise<string[]> {
  const messages = await readInbox(organizationId, `+88${subject.phone}`);
  return messages
    .map((message) => message.text)
    .filter((text) => text.includes(subject.listingNumber));
}

function sentRecords(organizationId: string): Promise<number> {
  return harness.connections.tenantShared
    .collection("customer_sms_sent")
    .countDocuments({ organizationId });
}

async function forgetProcessedMarker(eventId: string): Promise<void> {
  await harness.connections.platform
    .collection("processed_events")
    .deleteMany({ eventId, handlerKey: "directory.notifyReviewResult" });
}

async function accountRow(organizationId: string, customerAccountId: string) {
  return harness.connections.tenantShared
    .collection("customer_accounts")
    .findOne({ organizationId, customerAccountId });
}

describe("review-result SMS", () => {
  it("sends one SMS to the owner's phone with the business name and listing number", async () => {
    const world = await aDirectoryWorld();
    const subject = await reviewedListing(world, "APPROVED");

    const result = await runReview(
      reviewRegistry(),
      world.organizationA,
      DIRECTORY_EVENT_TYPE.LISTING_APPROVED,
    );

    expect(result).toBe("HANDLED");
    const texts = await reviewTexts(world.organizationA, subject);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain("Org A");
    expect(texts[0]).toContain(subject.listingNumber);
    expect(texts[0]).not.toContain("not approved");
  });

  it("sends the rejection reasons in the business language and never the staff note", async () => {
    const world = await aDirectoryWorld();
    const subject = await reviewedListing(world, "REJECTED", STAFF_ONLY_NOTE);

    const result = await runReview(
      reviewRegistry(),
      world.organizationA,
      DIRECTORY_EVENT_TYPE.LISTING_REJECTED,
    );

    expect(result).toBe("HANDLED");
    const texts = await reviewTexts(world.organizationA, subject);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain("অস্পষ্ট");
    expect(texts[0]).not.toContain("Unclear");
    expect(texts[0]).not.toContain(STAFF_ONLY_NOTE);
  });

  it("sends nothing when the same event is delivered again", async () => {
    const world = await aDirectoryWorld();
    const subject = await reviewedListing(world, "APPROVED");
    const registry = reviewRegistry();
    const event = await newestReviewEvent(
      world.organizationA,
      DIRECTORY_EVENT_TYPE.LISTING_APPROVED,
    );

    expect(
      await runReview(registry, world.organizationA, DIRECTORY_EVENT_TYPE.LISTING_APPROVED),
    ).toBe("HANDLED");
    await forgetProcessedMarker(event.eventId);
    expect(
      await runReview(registry, world.organizationA, DIRECTORY_EVENT_TYPE.LISTING_APPROVED),
    ).toBe("HANDLED");

    expect(await reviewTexts(world.organizationA, subject)).toHaveLength(1);
    expect(await sentRecords(world.organizationA)).toBe(1);
  });

  it("rolls the sent record back when the send fails, and the retry sends once", async () => {
    const world = await aDirectoryWorld();
    const subject = await reviewedListing(world, "APPROVED");
    const failing = reviewRegistry({
      sender: { send: () => Promise.reject(new Error("provider down")) },
    });

    await expect(
      runReview(failing, world.organizationA, DIRECTORY_EVENT_TYPE.LISTING_APPROVED),
    ).rejects.toThrow("provider down");
    expect(await sentRecords(world.organizationA)).toBe(0);
    expect(await reviewTexts(world.organizationA, subject)).toHaveLength(0);

    expect(
      await runReview(reviewRegistry(), world.organizationA, DIRECTORY_EVENT_TYPE.LISTING_APPROVED),
    ).toBe("HANDLED");
    expect(await sentRecords(world.organizationA)).toBe(1);
    expect(await reviewTexts(world.organizationA, subject)).toHaveLength(1);
  });

  it("sends nothing when the business switched the setting off", async () => {
    const world = await aDirectoryWorld();
    const subject = await reviewedListing(world, "APPROVED");
    const switched = await world.alice.call("patch", `/orgs/${world.organizationA}/settings`, {
      items: [{ settingKey: "directory.notifyReviewBySms", value: false }],
    });
    expect(switched.status).toBe(200);

    expect(
      await runReview(reviewRegistry(), world.organizationA, DIRECTORY_EVENT_TYPE.LISTING_APPROVED),
    ).toBe("HANDLED");
    expect(await reviewTexts(world.organizationA, subject)).toHaveLength(0);
    expect(await sentRecords(world.organizationA)).toBe(0);
  });

  it("sends the review result through the configured gateway and records its SMS purpose", async () => {
    const world = await aDirectoryWorld();
    const subject = await reviewedListing(world, "APPROVED");
    const superAdmin = await createPlatformActor(harness.app, harness.connections, [
      PLATFORM_ROLE.SUPER_ADMIN,
    ]);
    const gateway = await superAdmin.call("put", "/sms-gateway", {
      version: 0,
      enabled: true,
      activeProvider: "BULKSMSBD",
      bulksmsbd: { senderId: "REVIEW", apiKey: "review-platform-key" },
    });
    expect(gateway.status).toBe(200);
    const gatewaySender = buildGatewaySmsSender({
      config: harness.config.sms,
      clock: harness.clock,
      limits: { async assertBelow() {} },
      policy: {
        async read() {
          return { dailyLimit: 100, timeZone: "Asia/Dhaka" };
        },
      },
    });
    const registry = reviewRegistry({
      smsDriver: "gateway",
      gatewaySender,
    });

    const result = await runReview(
      registry,
      world.organizationA,
      DIRECTORY_EVENT_TYPE.LISTING_APPROVED,
    );

    expect(result).toBe("HANDLED");
    expect(smsStub.requests.some((request) => request.url === "/smsapi")).toBe(true);
    const logs = await harness.connections.tenantShared
      .collection("sms_logs")
      .find({
        organizationId: world.organizationA,
        purpose: SMS_PURPOSE.LISTING_REVIEW_RESULT,
        outcome: "SENT",
      })
      .toArray();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.["phoneLastDigits"]).toBe(subject.phone.slice(-3));
  });

  it("does nothing and does not fail while the SMS driver is disabled", async () => {
    const world = await aDirectoryWorld();
    const subject = await reviewedListing(world, "APPROVED");

    const result = await runReview(
      reviewRegistry({ smsDriver: "disabled" }),
      world.organizationA,
      DIRECTORY_EVENT_TYPE.LISTING_APPROVED,
    );

    expect(result).toBe("HANDLED");
    expect(await reviewTexts(world.organizationA, subject)).toHaveLength(0);
    expect(harness.logs.text()).toContain("SMS_DISABLED");
  });

  it("sends nothing to a blocked or erased customer account", async () => {
    const world = await aDirectoryWorld();
    const blocked = await reviewedListing(world, "APPROVED");
    const blockable = await accountRow(world.organizationA, blocked.customerAccountId);
    if (blockable === null) throw new Error("customer account missing");
    const blockedResponse = await world.alice.call(
      "post",
      `/orgs/${world.organizationA}/contacts/${blockable["contactId"] as string}/customer-account/block`,
      { version: blockable["version"] as number },
    );
    expect(blockedResponse.status).toBe(200);
    expect(
      await runReview(reviewRegistry(), world.organizationA, DIRECTORY_EVENT_TYPE.LISTING_APPROVED),
    ).toBe("HANDLED");
    expect(await reviewTexts(world.organizationA, blocked)).toHaveLength(0);

    const erased = await reviewedListing(world, "APPROVED");
    await harness.connections.tenantShared.collection("customer_accounts").deleteOne({
      organizationId: world.organizationA,
      customerAccountId: erased.customerAccountId,
    });
    expect(
      await runReview(reviewRegistry(), world.organizationA, DIRECTORY_EVENT_TYPE.LISTING_APPROVED),
    ).toBe("HANDLED");
    expect(await reviewTexts(world.organizationA, erased)).toHaveLength(0);
    expect(harness.logs.text()).toContain("ACCOUNT_MISSING");
  });

  it("does nothing while the directory module is off", async () => {
    const world = await aDirectoryWorld();
    const subject = await reviewedListing(world, "APPROVED");

    const result = await runReview(
      reviewRegistry(),
      world.organizationA,
      DIRECTORY_EVENT_TYPE.LISTING_APPROVED,
      false,
    );

    expect(result).toBe("SKIPPED_MODULE_OFF");
    expect(await reviewTexts(world.organizationA, subject)).toHaveLength(0);
  });

  it("never logs the SMS text or keeps it in the sent record", async () => {
    const world = await aDirectoryWorld();
    const subject = await reviewedListing(world, "REJECTED", STAFF_ONLY_NOTE);

    await runReview(reviewRegistry(), world.organizationA, DIRECTORY_EVENT_TYPE.LISTING_REJECTED);
    const [text = ""] = await reviewTexts(world.organizationA, subject);
    const records = await harness.connections.tenantShared
      .collection("customer_sms_sent")
      .find({ organizationId: world.organizationA })
      .toArray();

    expect(text).not.toBe("");
    expect(harness.logs.text()).not.toContain(text);
    expect(harness.logs.text()).not.toContain(`+88${subject.phone}`);
    expect(JSON.stringify(records)).not.toContain(text);
    expect(JSON.stringify(records)).not.toContain(subject.phone);
  });
});
