import { ERROR_CODE } from "@banijjik/contracts";
import type { Connection } from "mongoose";
import { AppError } from "../http/app-error.js";

export interface DatabaseConnections {
  readonly platform: Connection;
  /** A database on the same cluster client as `platform`, so one session spans both (ADR-043). */
  readonly tenantShared: Connection;
  close(): Promise<void>;
}

let current: DatabaseConnections | undefined;

export function setDatabaseConnections(connections: DatabaseConnections): void {
  current = connections;
}

/** Only forgets the connections when they are still the registered ones, so a late close cannot unset a newer set. */
export function clearDatabaseConnections(connections: DatabaseConnections): void {
  if (current === connections) current = undefined;
}

export function getDatabaseConnections(): DatabaseConnections {
  if (current === undefined) {
    throw new AppError({ code: ERROR_CODE.INTERNAL, messageKey: "errors.database_not_connected" });
  }
  return current;
}
