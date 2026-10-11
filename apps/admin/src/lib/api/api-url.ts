import { API_BASE_URL } from "../../config/api-base-url";

export const API_PREFIX = "/api/v1";

export function buildApiUrl(path: string): string {
  return `${API_BASE_URL}${API_PREFIX}${path}`;
}
