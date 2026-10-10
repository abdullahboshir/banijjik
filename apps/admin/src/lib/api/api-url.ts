import { env } from "../../config/env";

const API_PREFIX = "/api/v1";

export function buildApiUrl(path: string): string {
  return `${env.NEXT_PUBLIC_API_BASE_URL}${API_PREFIX}${path}`;
}
