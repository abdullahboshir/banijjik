import { z } from "zod";

export const requestSchema = z.object({ name: z.string() });
