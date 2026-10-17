import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
import type { StorageConfig } from "../../../../config/index.js";
import type { FileStorage } from "../application/ports/file-ports.js";
import { assertValidStorageKey } from "./storage-key.js";

type ObjectStorageConfig = Extract<StorageConfig, { driver: "s3" }>;

const MISSING_OBJECT_ERROR_NAME = "NoSuchKey";

function isMissingObjectError(error: unknown): boolean {
  return error instanceof Error && error.name === MISSING_OBJECT_ERROR_NAME;
}

/** Any S3-compatible service: AWS, Cloudflare R2, MinIO, DigitalOcean Spaces (ADR-109). */
export class S3FileStorage implements FileStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ObjectStorageConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      ...(config.endpoint === undefined ? {} : { endpoint: config.endpoint, forcePathStyle: true }),
    });
  }

  async put(key: string, bytes: Buffer, mimeType: string): Promise<void> {
    assertValidStorageKey(key);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: bytes, ContentType: mimeType }),
    );
  }

  async get(key: string): Promise<Readable | undefined> {
    assertValidStorageKey(key);
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      // Safe: in Node the SDK returns the body as a Readable stream.
      return response.Body as Readable | undefined;
    } catch (error) {
      if (isMissingObjectError(error)) return undefined;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    assertValidStorageKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
