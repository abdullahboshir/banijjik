import { z } from "zod";
import { uuidV7Schema } from "../uuid-v7.schema.js";

export const createGuestSessionBodySchema = z.object({}).strict().default({});
export type CreateGuestSessionBodyInput = z.infer<typeof createGuestSessionBodySchema>;

export const guestSessionParamsSchema = z
  .object({
    guestSessionId: uuidV7Schema,
  })
  .strict();
export type GuestSessionParamsInput = z.infer<typeof guestSessionParamsSchema>;
