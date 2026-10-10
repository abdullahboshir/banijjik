import type { ClientSession } from "mongoose";

/**
 * `{ session }` for a Mongoose query, or nothing when there is no session. With
 * exactOptionalPropertyTypes a literal `session: undefined` is a type error, so queries spread this.
 */
export function sessionOption(session: ClientSession | undefined): { session?: ClientSession } {
  return session === undefined ? {} : { session };
}
