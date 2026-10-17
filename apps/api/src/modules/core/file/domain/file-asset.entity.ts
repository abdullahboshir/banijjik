import {
  FILE_STATUS,
  FILE_VISIBILITY_BY_PURPOSE,
  type FilePurpose,
  type FileStatus,
  type FileVariant,
  type FileVisibility,
} from "@banijjik/contracts/file";
import { newId, type Id, type OrganizationId, type UserId } from "@banijjik/ids";
import { ORIGINAL_NAME_MAX_LENGTH } from "./file-limits.js";

export type FileAssetId = Id<"FileAsset">;

const INITIAL_VERSION = 1;
const FALLBACK_NAME = "file";
const UNSAFE_NAME_CHARACTERS = /[^\p{L}\p{M}\p{N}._ -]/gu;

export interface StoredVariant {
  readonly variantKey: FileVariant;
  readonly byteSize: number;
  readonly width?: number;
  readonly height?: number;
}

export interface FileAssetProps {
  readonly fileId: FileAssetId;
  readonly organizationId: OrganizationId;
  readonly purpose: FilePurpose;
  readonly visibility: FileVisibility;
  readonly mimeType: string;
  /** The sum of the stored variants: what counts against the organization's quota. */
  readonly byteSize: number;
  readonly originalName: string;
  readonly storageKey: string;
  readonly variants: readonly StoredVariant[];
  readonly status: FileStatus;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId;
  readonly updatedByUserId: UserId;
}

export interface NewFileAssetInput {
  readonly fileId: FileAssetId;
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly purpose: FilePurpose;
  readonly mimeType: string;
  readonly originalName: string;
  readonly variants: readonly StoredVariant[];
  readonly now: Date;
}

export function newFileId(): FileAssetId {
  return newId<FileAssetId>();
}

/** The folder of one file's objects: `org/{organizationId}/{fileId}`. Built only from generated ids. */
export function storageKeyPrefix(organizationId: OrganizationId, fileId: FileAssetId): string {
  return `org/${organizationId}/${fileId}`;
}

export function storageKeyOf(storageKey: string, variant: FileVariant): string {
  return `${storageKey}/${variant}`;
}

/** The name is shown, never used as a path: separators, control and unusual characters are dropped. */
export function sanitizeOriginalName(name: string): string {
  const cleaned = name.replace(UNSAFE_NAME_CHARACTERS, "").trim();
  const shortened = cleaned.slice(0, ORIGINAL_NAME_MAX_LENGTH);
  return shortened === "" ? FALLBACK_NAME : shortened;
}

export class FileAsset {
  private constructor(private readonly props: FileAssetProps) {}

  static create(input: NewFileAssetInput): FileAsset {
    const byteSize = input.variants.reduce((total, variant) => total + variant.byteSize, 0);
    return new FileAsset({
      fileId: input.fileId,
      organizationId: input.organizationId,
      purpose: input.purpose,
      visibility: FILE_VISIBILITY_BY_PURPOSE[input.purpose],
      mimeType: input.mimeType,
      byteSize,
      originalName: sanitizeOriginalName(input.originalName),
      storageKey: storageKeyPrefix(input.organizationId, input.fileId),
      variants: input.variants,
      status: FILE_STATUS.ACTIVE,
      version: INITIAL_VERSION,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    });
  }

  static restore(props: FileAssetProps): FileAsset {
    return new FileAsset(props);
  }

  get fileId(): FileAssetId {
    return this.props.fileId;
  }
  get organizationId(): OrganizationId {
    return this.props.organizationId;
  }
  get purpose(): FilePurpose {
    return this.props.purpose;
  }
  get visibility(): FileVisibility {
    return this.props.visibility;
  }
  get mimeType(): string {
    return this.props.mimeType;
  }
  get byteSize(): number {
    return this.props.byteSize;
  }
  get originalName(): string {
    return this.props.originalName;
  }
  get storageKey(): string {
    return this.props.storageKey;
  }
  get variants(): readonly StoredVariant[] {
    return this.props.variants;
  }
  get status(): FileStatus {
    return this.props.status;
  }
  get version(): number {
    return this.props.version;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get createdByUserId(): UserId {
    return this.props.createdByUserId;
  }
  get updatedByUserId(): UserId {
    return this.props.updatedByUserId;
  }

  hasVariant(variant: FileVariant): boolean {
    return this.props.variants.some((stored) => stored.variantKey === variant);
  }
}
