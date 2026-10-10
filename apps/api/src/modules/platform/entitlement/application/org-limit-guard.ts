import { ERROR_CODE, type LimitKey } from "@banijjik/contracts";
import type { LimitGuard } from "../../../../kernel/access/index.js";
import { AppError } from "../../../../kernel/http/index.js";
import type { ResolvedOrgConfig } from "../domain/resolved-org-config.js";

export interface OrgLimitSource {
  current(): Promise<{ readonly config: Pick<ResolvedOrgConfig, "limits"> }>;
}

/** Checks a count against the limits of the resolved config of the current request's organization. */
export class OrgLimitGuard implements LimitGuard {
  constructor(private readonly source: OrgLimitSource) {}

  async assertBelow(limitKey: LimitKey, currentCount: number): Promise<void> {
    const { config } = await this.source.current();
    const limit = config.limits[limitKey];
    if (limit === null || currentCount < limit) return;
    throw new AppError({ code: ERROR_CODE.LIMIT_REACHED, details: { limitKey, limit } });
  }
}
