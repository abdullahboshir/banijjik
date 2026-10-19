import { FILE_PURPOSE, type FileAssetResponse } from "@banijjik/contracts/file";
import {
  DIRECTORY_PHOTO_POLICY,
  LISTING_VIEWER,
  type ListingResponse,
} from "@banijjik/contracts/directory";
import type { CustomerAccountId, OrganizationId } from "@banijjik/ids";
import type { UploadFileUseCase } from "../../../../core/file/index.js";
import { listingConflict, listingNotFound, photoPolicyNone } from "../../domain/errors.js";
import type { DirectoryDependencies } from "../directory-dependencies.js";
import { asListingFieldRules } from "../ports/directory-context-ports.js";
import { toListingResponse } from "../listing-view.js";
import { recordListingChange, AUDIT_ACTION, DIRECTORY_EVENT_TYPE } from "../listing-records.js";
import { finalReasonKeysOf } from "../submission-rules.js";

const MAX_LISTING_PHOTOS = 20;

export class UploadListingPhotoUseCase {
  constructor(
    private readonly dependencies: DirectoryDependencies,
    private readonly uploadFile: UploadFileUseCase,
  ) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly customerAccountId: CustomerAccountId;
    readonly originalName: string;
    readonly bytes: Buffer;
  }): Promise<{ readonly file: FileAssetResponse; readonly listing: ListingResponse }> {
    const photoPolicy = await this.dependencies.settings.photoPolicy(input.organizationId);
    if (photoPolicy === DIRECTORY_PHOTO_POLICY.NONE) throw photoPolicyNone();

    const existing = await this.dependencies.listings.findActiveByOwner(input.customerAccountId);
    if (existing === undefined) throw listingNotFound();
    if (existing.photoFileIds.length >= MAX_LISTING_PHOTOS) throw listingConflict();

    const file = await this.uploadFile.execute({
      organizationId: input.organizationId,
      actorUserId: null,
      purpose: FILE_PURPOSE.LISTING_PHOTO,
      originalName: input.originalName,
      bytes: input.bytes,
    });

    const [fields, reviewEdits, directory] = await Promise.all([
      this.dependencies.fields.forOrganization(input.organizationId),
      this.dependencies.settings.reviewEdits(input.organizationId),
      this.dependencies.template.directoryBlockOf(input.organizationId),
    ]);
    const rules = asListingFieldRules(fields);
    const saved = await this.dependencies.unitOfWork.run(async () => {
      const current = await this.dependencies.listings.findActiveByOwner(input.customerAccountId);
      if (current === undefined) throw listingNotFound();
      const updated = current.withOwnerData(
        {
          customFields: current.customFields,
          customFieldSearch: current.customFieldSearch,
          photoFileIds: [...current.photoFileIds, file.fileId],
        },
        this.dependencies.clock.now(),
        { reviewEdits, finalReasonKeys: finalReasonKeysOf(directory) },
      );
      const persisted = await this.dependencies.listings.save(updated, current.version, null);
      await recordListingChange(this.dependencies, {
        action: AUDIT_ACTION.LISTING_UPDATED,
        before: current,
        after: persisted,
        eventType: DIRECTORY_EVENT_TYPE.LISTING_UPDATED,
      });
      return persisted;
    });
    return {
      file,
      listing: toListingResponse({
        listing: saved,
        fields: rules,
        viewer: LISTING_VIEWER.OWNER,
        photoPolicy,
      }),
    };
  }
}
