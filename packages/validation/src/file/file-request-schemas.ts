import { FILE_PURPOSE, FILE_VARIANT } from "@banijjik/contracts/file";
import { z } from "zod";
import { uuidV7Schema } from "../uuid-v7.schema.js";

/** The `purpose` text field of the multipart upload. */
export const filePurposeSchema = z.enum(FILE_PURPOSE);

export const fileVariantSchema = z.enum(FILE_VARIANT);

export const fileIdParamsSchema = z.object({ fileId: uuidV7Schema });

export const fileContentQuerySchema = z.strictObject({ variant: fileVariantSchema.optional() });

/** `/public/files/{fileId}/{variant}`: no session, so both parts are checked before any lookup. */
export const publicFileParamsSchema = z.object({
  fileId: uuidV7Schema,
  variant: fileVariantSchema,
});
