import { z } from "zod";

const environmentSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.url({ protocol: /^https?$/ }),
  NEXT_PUBLIC_BRAND_NAME: z.string().trim().min(1),
});

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(source: Record<string, string | undefined>): Environment {
  const result = environmentSchema.safeParse(source);
  if (result.success) return result.data;
  const invalidNames = result.error.issues.map((issue) => issue.path.join("."));
  throw new Error(`Invalid environment variables: ${invalidNames.join(", ")}`);
}

// Next.js inlines NEXT_PUBLIC_* values only when each one is read by its full name.
export const env: Environment = parseEnvironment({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_BRAND_NAME: process.env.NEXT_PUBLIC_BRAND_NAME,
});
