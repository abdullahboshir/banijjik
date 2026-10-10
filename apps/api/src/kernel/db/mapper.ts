/**
 * Removes the Mongo internals from a lean result. Repositories call it before building a
 * domain object, so `_id` never leaves infrastructure (ADR-036).
 */
export function stripMongoInternals<Shape extends object>(
  document: Shape & { _id?: unknown; __v?: unknown },
): Omit<Shape, "_id" | "__v"> {
  const copy: { [key: string]: unknown } = { ...document };
  delete copy["_id"];
  delete copy["__v"];
  // Safe: only the two Mongo keys were removed, which is exactly what the return type says.
  return copy as Omit<Shape, "_id" | "__v">;
}
