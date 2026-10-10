import { z } from "zod";

/** The `Idempotency-Key` header: a UUID of any version (14-API.md section 2), compared in lowercase. */
export const idempotencyKeySchema = z.uuid().transform((key) => key.toLowerCase());
