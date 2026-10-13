import type { PlatformRole } from "../iam/platform-role.js";

/** One row of `GET /platform/operators` (14-API.md section 7). */
export interface PlatformOperatorSummary {
  platformOperatorId: string;
  userId: string;
  name: string;
  identifierHint: string;
  platformRoles: PlatformRole[];
  status: "ACTIVE" | "DISABLED";
  version: number;
  createdAt: string;
  updatedAt: string;
}
