export interface MongoUrlParts {
  /** Lower-cased and sorted, so two URLs naming the same cluster compare equal. */
  readonly hosts: readonly string[];
  readonly databaseName: string;
}

// mongodb://[user:password@]host1[:port][,host2[:port]]/database[?options]
const MONGO_URL_PARTS = /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)\/([^?]+)/;

/** Config already guarantees the shape, so a non-match means "not a usable URL" and returns undefined. */
export function parseMongoUrl(url: string): MongoUrlParts | undefined {
  const match = MONGO_URL_PARTS.exec(url);
  const hostList = match?.[1];
  const databaseName = match?.[2];
  if (hostList === undefined || databaseName === undefined) return undefined;
  const hosts = hostList
    .split(",")
    .map((host) => host.toLowerCase())
    .sort();
  return { hosts, databaseName: decodeURIComponent(databaseName) };
}
