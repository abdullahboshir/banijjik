import { z } from "zod";
import { ORGANIZATION_INDUSTRY_ENUM } from "@banijjik/contracts";

export const CreatePersonSchema = z.object({
  userId: z.string().uuid({ message: "Invalid User ID" }),
  industry: z.enum(ORGANIZATION_INDUSTRY_ENUM).optional(),
  firstName: z.string().min(1, { message: "First name is required" }),
  lastName: z.string().optional(),
  email: z.string().email({ message: "Invalid email" }),
  phone: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  dateOfBirth: z
    .preprocess((arg) => {
      if (typeof arg === "string" || arg instanceof Date) return new Date(arg);
      return arg;
    }, z.date())
    .optional(),
  designation: z.string().optional(),
  profileAttributes: z.record(z.string(), z.any()).optional(),
  status: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type CreatePersonInput = z.infer<typeof CreatePersonSchema>;
