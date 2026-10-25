import {
  AUDIT_ACTION,
  VALIDATION_FALLBACK_MESSAGE_KEY,
  VALIDATION_MESSAGE_KEYS,
} from "@banijjik/contracts";
import {
  DIRECTORY_EVENT_TYPE,
  DIRECTORY_PHOTO_POLICY,
  LISTING_VIEWER,
  type ListingResponse,
  type ListingUpsertRequest,
} from "@banijjik/contracts/directory";
import type { CustomerAccountId, OrganizationId } from "@banijjik/ids";
import { CUSTOM_FIELD_AUDIENCE, buildCustomFieldValuesSchema } from "@banijjik/validation";
import { toListingFilterEntries } from "@banijjik/validation/directory";
import { Listing } from "../../domain/listing.entity.js";
import { customFieldsInvalid, listingNotFound, photoPolicyNone } from "../../domain/errors.js";
import type { DirectoryDependencies } from "../directory-dependencies.js";
import { asListingFieldRules } from "../ports/directory-context-ports.js";
import { toListingResponse } from "../listing-view.js";
import { recordListingChange } from "../listing-records.js";
import { assertSubmissionRules, finalReasonKeysOf } from "../submission-rules.js";

interface ZodLikeIssue {
  readonly path: readonly PropertyKey[];
  readonly code: string;
}

/** Only the issue code is the message key, the same rule as the request validation (M.6 C2). */
function customFieldMessageKey(code: string): string {
  const messageKey = `validation.${code}`;
  return VALIDATION_MESSAGE_KEYS.includes(messageKey)
    ? messageKey
    : VALIDATION_FALLBACK_MESSAGE_KEY;
}

function customFieldIssueField(issue: ZodLikeIssue): { path: string; messageKey: string } {
  return {
    path: ["customFields", ...issue.path.map(String)].join("."),
    messageKey: customFieldMessageKey(issue.code),
  };
}

/**
 * Parses the custom field values against the form rules. A value the rules refuse becomes a 400
 * VALIDATION_ERROR naming `customFields.<fieldKey>`, never an unhandled ZodError (a 500).
 */
function parseCustomFieldValues(
  rules: ReturnType<typeof asListingFieldRules>,
  mode: "CREATE" | "UPDATE",
  customFields: Record<string, unknown>,
): Record<string, unknown> {
  const result = buildCustomFieldValuesSchema(rules, {
    audience: CUSTOM_FIELD_AUDIENCE.STOREFRONT,
    mode,
  }).safeParse(customFields);
  if (!result.success) {
    throw customFieldsInvalid(result.error.issues.map(customFieldIssueField));
  }
  return result.data as Record<string, unknown>;
}

export class GetMyListingUseCase {
  constructor(private readonly dependencies: DirectoryDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly customerAccountId: CustomerAccountId;
  }): Promise<ListingResponse> {
    const listing = await this.dependencies.listings.findActiveByOwner(input.customerAccountId);
    if (listing === undefined) throw listingNotFound();
    const [fields, photoPolicy] = await Promise.all([
      this.dependencies.fields.forOrganization(input.organizationId),
      this.dependencies.settings.photoPolicy(input.organizationId),
    ]);
    return toListingResponse({
      listing,
      fields: asListingFieldRules(fields),
      viewer: LISTING_VIEWER.OWNER,
      photoPolicy,
    });
  }
}

async function createOwnerListing(
  dependencies: DirectoryDependencies,
  input: {
    readonly organizationId: OrganizationId;
    readonly customerAccountId: CustomerAccountId;
    readonly customFields: Record<string, unknown>;
    readonly customFieldSearch: readonly { fieldKey: string; value: string }[];
    readonly photoFileIds: readonly string[];
    readonly listingNumberPrefix: string;
  },
): Promise<Listing> {
  const listingNumber = await dependencies.sequences.nextListingNumber(input.listingNumberPrefix);
  const created = Listing.create({
    organizationId: input.organizationId,
    listingNumber,
    ownerCustomerAccountId: input.customerAccountId,
    customFields: input.customFields,
    customFieldSearch: input.customFieldSearch,
    photoFileIds: input.photoFileIds,
    createdByUserId: null,
    now: dependencies.clock.now(),
  });
  await dependencies.listings.insert(created);
  await recordListingChange(dependencies, {
    action: AUDIT_ACTION.LISTING_CREATED,
    before: undefined,
    after: created,
    eventType: DIRECTORY_EVENT_TYPE.LISTING_UPDATED,
  });
  return created;
}

async function updateOwnerListing(
  dependencies: DirectoryDependencies,
  input: {
    readonly existing: Listing;
    readonly body: ListingUpsertRequest;
    readonly parsed: Record<string, unknown>;
    readonly rules: ReturnType<typeof asListingFieldRules>;
    readonly reviewEdits: boolean;
    readonly finalReasons: ReadonlySet<string>;
  },
): Promise<Listing> {
  const merged = { ...input.existing.customFields, ...input.parsed };
  const updated = input.existing.withOwnerData(
    {
      customFields: merged,
      customFieldSearch: toListingFilterEntries(merged, input.rules),
      photoFileIds: input.body.photoFileIds ?? input.existing.photoFileIds,
    },
    dependencies.clock.now(),
    { reviewEdits: input.reviewEdits, finalReasonKeys: input.finalReasons },
  );
  const persisted = await dependencies.listings.save(
    updated,
    input.body.version ?? input.existing.version,
    null,
  );
  await recordListingChange(dependencies, {
    action: AUDIT_ACTION.LISTING_UPDATED,
    before: input.existing,
    after: persisted,
    eventType:
      persisted.status === "SUBMITTED" && input.existing.status === "APPROVED"
        ? DIRECTORY_EVENT_TYPE.LISTING_SUBMITTED
        : DIRECTORY_EVENT_TYPE.LISTING_UPDATED,
  });
  return persisted;
}

export class UpsertMyListingUseCase {
  constructor(private readonly dependencies: DirectoryDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly customerAccountId: CustomerAccountId;
    readonly body: ListingUpsertRequest;
  }): Promise<ListingResponse> {
    const { listings, unitOfWork, fields, settings, template } = this.dependencies;
    const effective = await fields.forOrganization(input.organizationId);
    const rules = asListingFieldRules(effective);
    const parsed = parseCustomFieldValues(rules, "UPDATE", input.body.customFields ?? {});
    const photoFileIds = input.body.photoFileIds ?? [];
    const photoPolicy = await settings.photoPolicy(input.organizationId);
    if (photoFileIds.length > 0 && photoPolicy === DIRECTORY_PHOTO_POLICY.NONE) {
      throw photoPolicyNone();
    }
    const search = toListingFilterEntries(parsed, rules);
    const [reviewEdits, directory] = await Promise.all([
      settings.reviewEdits(input.organizationId),
      template.directoryBlockOf(input.organizationId),
    ]);
    const finalReasons = finalReasonKeysOf(directory);
    const saved = await unitOfWork.run(async () => {
      const existing = await listings.findActiveByOwner(input.customerAccountId);
      if (existing === undefined) {
        return createOwnerListing(this.dependencies, {
          organizationId: input.organizationId,
          customerAccountId: input.customerAccountId,
          customFields: parsed,
          customFieldSearch: search,
          photoFileIds,
          listingNumberPrefix: directory?.listingNumberPrefix ?? "L",
        });
      }
      return updateOwnerListing(this.dependencies, {
        existing,
        body: input.body,
        parsed,
        rules,
        reviewEdits,
        finalReasons,
      });
    });
    return toListingResponse({
      listing: saved,
      fields: rules,
      viewer: LISTING_VIEWER.OWNER,
      photoPolicy,
    });
  }
}

export class SubmitMyListingUseCase {
  constructor(private readonly dependencies: DirectoryDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly customerAccountId: CustomerAccountId;
    readonly consents: readonly { readonly consentKey: string }[];
  }): Promise<ListingResponse> {
    const { listings, unitOfWork, clock, fields, settings, template, phones } = this.dependencies;
    const existing = await listings.findActiveByOwner(input.customerAccountId);
    if (existing === undefined) throw listingNotFound();
    const effective = await fields.forOrganization(input.organizationId);
    const rules = asListingFieldRules(effective);
    parseCustomFieldValues(rules, "CREATE", existing.customFields);
    const [directory, accountPhone, photoPolicy] = await Promise.all([
      template.directoryBlockOf(input.organizationId),
      phones.phoneOf(input.customerAccountId),
      settings.photoPolicy(input.organizationId),
    ]);
    const consentsAccepted = assertSubmissionRules({
      customFields: existing.customFields,
      fields: rules,
      accountPhoneE164: accountPhone,
      consents: input.consents,
      directory,
      now: clock.now(),
    });
    const saved = await unitOfWork.run(async () => {
      const submitted = existing.submit(
        consentsAccepted,
        clock.now(),
        finalReasonKeysOf(directory),
      );
      const persisted = await listings.save(submitted, existing.version, null);
      await recordListingChange(this.dependencies, {
        action: AUDIT_ACTION.LISTING_SUBMITTED,
        before: existing,
        after: persisted,
        eventType: DIRECTORY_EVENT_TYPE.LISTING_SUBMITTED,
      });
      return persisted;
    });
    return toListingResponse({
      listing: saved,
      fields: rules,
      viewer: LISTING_VIEWER.OWNER,
      photoPolicy,
    });
  }
}

export class ArchiveMyListingUseCase {
  constructor(private readonly dependencies: DirectoryDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly customerAccountId: CustomerAccountId;
  }): Promise<void> {
    const { listings, unitOfWork, clock } = this.dependencies;
    await unitOfWork.run(async () => {
      const existing = await listings.findActiveByOwner(input.customerAccountId);
      if (existing === undefined) throw listingNotFound();
      const archived = existing.archive(clock.now());
      const persisted = await listings.save(archived, existing.version, null);
      await recordListingChange(this.dependencies, {
        action: AUDIT_ACTION.LISTING_ARCHIVED,
        before: existing,
        after: persisted,
        eventType: DIRECTORY_EVENT_TYPE.LISTING_ARCHIVED,
      });
    });
  }
}
