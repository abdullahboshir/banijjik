import { isUuidV7 } from "@banijjik/ids";
import { z } from "zod";

/** Zod schema for any domain ID (UUID v7, lowercase). */
export const uuidV7Schema = z.string().refine(isUuidV7, { message: "ids.invalid_uuid_v7" });
