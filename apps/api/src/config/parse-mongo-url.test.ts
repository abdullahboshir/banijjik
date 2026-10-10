import { describe, expect, it } from "vitest";
import { parseMongoUrl } from "./parse-mongo-url.js";

describe("parseMongoUrl", () => {
  it("returns the sorted lower-case hosts, the database name, the credentials and the sorted options", () => {
    const parts = parseMongoUrl(
      "mongodb://user:secret@Host-B:27017,host-a:27018/orders?replicaSet=rs0&authSource=admin",
    );

    expect(parts).toEqual({
      hosts: ["host-a:27018", "host-b:27017"],
      databaseName: "orders",
      credentials: "user:secret",
      options: "authSource=admin&replicaSet=rs0",
    });
  });

  it("returns empty credentials and options when the URL has none", () => {
    expect(parseMongoUrl("mongodb://localhost:27017/orders")).toMatchObject({
      credentials: "",
      options: "",
    });
  });

  it("returns undefined for a URL without a database name", () => {
    expect(parseMongoUrl("mongodb://localhost:27017")).toBeUndefined();
  });
});
