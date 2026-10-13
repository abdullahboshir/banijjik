import { z } from "zod";

const environmentSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.url({ protocol: /^https?$/ }),
  NEXT_PUBLIC_BRAND_NAME: z.string().trim().min(1),
});

export type Environment = z.infer<typeof environmentSchema>;

/**
 * Validates the variables every web app needs. Each app reads `process.env.NEXT_PUBLIC_*` by full name in its
 * own `env.ts` (Next.js inlines them only that way) and passes the values here.
 */
export function parseEnvironment(source: Record<string, string | undefined>): Environment {
  const result = environmentSchema.safeParse(source);
  if (result.success) return result.data;
  const invalidNames = result.error.issues.map((issue) => issue.path.join("."));
  throw new Error(`Invalid environment variables: ${invalidNames.join(", ")}`);
}
