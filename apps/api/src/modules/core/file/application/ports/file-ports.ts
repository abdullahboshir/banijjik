import type { FileVariant } from "@banijjik/contracts/file";
import type { UserId } from "@banijjik/ids";
import type { Readable } from "node:stream";
import type { FileAsset, FileAssetId } from "../../domain/file-asset.entity.js";

export interface FileAssetRepository {
  insert(asset: FileAsset): Promise<void>;
  /** Visible to the tenant plugin's organization only; another organization's file is not found. */
  findById(fileId: FileAssetId): Promise<FileAsset | undefined>;
  /** Marks the file DELETED if its version is still `expectedVersion`. */
  markDeleted(asset: FileAsset, expectedVersion: number, actorUserId: UserId): Promise<void>;
}

/** Where the bytes live (ADR-109). Keys are `org/{organizationId}/{fileId}/{variant}`. */
export interface FileStorage {
  put(key: string, bytes: Buffer, mimeType: string): Promise<void>;
  /** The object as a stream, or undefined when it does not exist. */
  get(key: string): Promise<Readable | undefined>;
  /** Removing an object that is already gone is not an error. */
  delete(key: string): Promise<void>;
}

/** The running total of stored bytes of the current organization (the interim quota, ADR-109). */
export interface FileUsageRepository {
  /** Creates the counter at zero if the organization has none yet. */
  ensure(): Promise<void>;
  usedBytes(): Promise<number>;
  /** Adds `bytes` only if the total stays within `limitBytes`. False means it would not. */
  reserve(bytes: number, limitBytes: number): Promise<boolean>;
  release(bytes: number): Promise<void>;
}

export interface ProcessedVariant {
  readonly variantKey: FileVariant;
  readonly bytes: Buffer;
  readonly width?: number;
  readonly height?: number;
}

export interface ImageProcessor {
  /**
   * Re-encodes an image into every stored size, without its metadata. An image that cannot be
   * decoded throws the "type not allowed" error: a file that only looks like an image is refused.
   */
  process(bytes: Buffer): Promise<readonly ProcessedVariant[]>;
}

export interface FileUnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result>;
}
