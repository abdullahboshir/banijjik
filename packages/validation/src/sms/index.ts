import { z } from "zod";
import { SMS_PROVIDER, SMS_OUTCOME } from "@banijjik/contracts/sms";

export const smsGatewaySchema = z
  .object({
    version: z.number().int().nonnegative(),
    enabled: z.boolean(),
    activeProvider: z.enum(SMS_PROVIDER).nullable(),
    adareach: z
      .object({
        username: z.string().min(1).max(100),
        password: z.string().min(1).max(200).optional(),
        senderId: z.string().min(1).max(20),
      })
      .strict()
      .nullable()
      .optional(),
    bulksmsbd: z
      .object({
        apiKey: z.string().min(1).max(200).optional(),
        senderId: z.string().min(1).max(20),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict();
export type SmsGatewayInput = z.infer<typeof smsGatewaySchema>;
export const smsTestSchema = z
  .object({ phoneE164: z.string().regex(/^\+[1-9]\d{6,14}$/) })
  .strict();
export const smsLogQuerySchema = z
  .object({
    outcome: z.enum(SMS_OUTCOME).optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    cursor: z.string().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
