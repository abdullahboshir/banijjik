import { createHash } from "node:crypto";
import type { Clock } from "../../../../kernel/time/index.js";
import type { PackageReader } from "../../package/index.js";

/** A package edit reaches every organization within this time, without a fan-out job (ADR-091). */
export const PACKAGE_CATALOG_REFRESH_MILLISECONDS = 5000;

interface Stamp {
  readonly value: string;
  readonly refreshedAtMilliseconds: number;
}

/**
 * A hash of every ACTIVE package at its version. It is part of the config cache key, so editing
 * a package changes the key of every organization that could use it. It is held in memory and
 * read again at most every 5 seconds: that bounds the database load of the hot path, and it is
 * the delay after which a package edit becomes visible (the trade-off recorded in ADR-091).
 */
export class PackageCatalogVersion {
  private stamp: Stamp | undefined;
  private pending: Promise<string> | undefined;

  constructor(
    private readonly packages: Pick<PackageReader, "listActiveVersions">,
    private readonly clock: Clock,
  ) {}

  async current(): Promise<string> {
    const nowMilliseconds = this.clock.now().getTime();
    const { stamp } = this;
    if (
      stamp !== undefined &&
      nowMilliseconds - stamp.refreshedAtMilliseconds < PACKAGE_CATALOG_REFRESH_MILLISECONDS
    ) {
      return stamp.value;
    }
    // Requests that arrive during a refresh share it instead of each querying.
    this.pending ??= this.refresh(nowMilliseconds).finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }

  private async refresh(nowMilliseconds: number): Promise<string> {
    const versions = await this.packages.listActiveVersions();
    const lines = versions.map((entry) => `${entry.packageId}:${entry.version}`).sort();
    const value = createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16);
    this.stamp = { value, refreshedAtMilliseconds: nowMilliseconds };
    return value;
  }
}
