import { describe, expect, it } from "vitest";
import { MutableClock } from "../../../../test-support/mutable-clock.js";
import type { PackageVersionStamp } from "../../package/index.js";
import {
  PACKAGE_CATALOG_REFRESH_MILLISECONDS,
  PackageCatalogVersion,
} from "./package-catalog-version.js";

function aCatalog(initial: PackageVersionStamp[]) {
  const state = { stamps: initial, reads: 0 };
  const packages = {
    listActiveVersions: async () => {
      state.reads += 1;
      return state.stamps;
    },
  };
  return { state, packages };
}

describe("PackageCatalogVersion", () => {
  it("reads the packages once and answers from memory until the refresh interval has passed", async () => {
    const clock = new MutableClock();
    const { state, packages } = aCatalog([{ packageId: "p1", version: 1 }]);
    const catalogVersion = new PackageCatalogVersion(packages, clock);

    const first = await catalogVersion.current();
    clock.advanceSeconds(PACKAGE_CATALOG_REFRESH_MILLISECONDS / 1000 - 1);
    state.stamps = [{ packageId: "p1", version: 2 }];
    const stillCached = await catalogVersion.current();
    clock.advanceSeconds(2);
    const refreshed = await catalogVersion.current();

    expect(stillCached).toBe(first);
    expect(refreshed).not.toBe(first);
    expect(state.reads).toBe(2);
  });

  it("gives the same version whatever order the packages come in, and a new one when a version changes", async () => {
    const clock = new MutableClock();
    const forward = aCatalog([
      { packageId: "p1", version: 1 },
      { packageId: "p2", version: 4 },
    ]);
    const backward = aCatalog([
      { packageId: "p2", version: 4 },
      { packageId: "p1", version: 1 },
    ]);
    const edited = aCatalog([
      { packageId: "p1", version: 1 },
      { packageId: "p2", version: 5 },
    ]);

    const versions = await Promise.all(
      [forward, backward, edited].map((catalog) =>
        new PackageCatalogVersion(catalog.packages, clock).current(),
      ),
    );

    expect(versions[0]).toBe(versions[1]);
    expect(versions[2]).not.toBe(versions[0]);
  });

  it("lets simultaneous callers share one read", async () => {
    const clock = new MutableClock();
    const { state, packages } = aCatalog([{ packageId: "p1", version: 1 }]);
    const catalogVersion = new PackageCatalogVersion(packages, clock);

    await Promise.all([
      catalogVersion.current(),
      catalogVersion.current(),
      catalogVersion.current(),
    ]);

    expect(state.reads).toBe(1);
  });
});
