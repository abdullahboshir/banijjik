import type { PosCatalogRow } from "@banijjik/contracts/pos";

const DATABASE_NAME = "pos-catalog";
const DATABASE_VERSION = 1;
const STORE_NAME = "catalog";

/** The cached catalog of one till: its rows and the server time of the snapshot they came from. */
export interface CachedCatalog {
  readonly cacheKey: string;
  readonly rows: readonly PosCatalogRow[];
  readonly serverTime: string;
}

/** One cache per organization and location, so a till that moves never reads another shop's prices. */
export function catalogCacheKeyOf(organizationId: string, locationId: string): string {
  return `${organizationId}:${locationId}`;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(STORE_NAME, { keyPath: "cacheKey" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * The cache is an accelerator, never the truth: without IndexedDB (private windows, blocked storage)
 * the till reads the full snapshot each time. Every failure here returns "no cache".
 */
export async function readCachedCatalog(cacheKey: string): Promise<CachedCatalog | null> {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const entry = await requestToPromise<CachedCatalog | undefined>(
      transaction.objectStore(STORE_NAME).get(cacheKey),
    );
    database.close();
    return entry ?? null;
  } catch {
    return null;
  }
}

export async function writeCachedCatalog(entry: CachedCatalog): Promise<void> {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    await requestToPromise(transaction.objectStore(STORE_NAME).put(entry));
    database.close();
  } catch {
    return;
  }
}
