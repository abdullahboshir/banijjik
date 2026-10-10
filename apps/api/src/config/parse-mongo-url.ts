export interface MongoUrlParts {
  /** Lower-cased and sorted, so two URLs naming the same cluster compare equal. */
  readonly hosts: readonly string[];
  readonly databaseName: string;
  /** The `user:password` part, or an empty string. Compared, never logged. */
  readonly credentials: string;
  /** Query options, sorted, so two URLs with the same options in another order compare equal. */
  readonly options: string;
}

// mongodb://[user:password@]host1[:port][,host2[:port]]/database[?options]
const MONGO_URL_PARTS = /^mongodb(?:\+srv)?:\/\/(?:([^@/]*)@)?([^/?]+)\/([^?]+)(?:\?(.*))?$/;

function sortOptions(query: string | undefined): string {
  return (query ?? "")
    .split("&")
    .filter((pair) => pair.length > 0)
    .sort()
    .join("&");
}

/** Config already guarantees the shape, so a non-match means "not a usable URL" and returns undefined. */
export function parseMongoUrl(url: string): MongoUrlParts | undefined {
  const match = MONGO_URL_PARTS.exec(url);
  const hostList = match?.[2];
  const databaseName = match?.[3];
  if (hostList === undefined || databaseName === undefined) return undefined;
  const hosts = hostList
    .split(",")
    .map((host) => host.toLowerCase())
    .sort();
  return {
    hosts,
    databaseName: decodeURIComponent(databaseName),
    credentials: match?.[1] ?? "",
    options: sortOptions(match?.[4]),
  };
}
