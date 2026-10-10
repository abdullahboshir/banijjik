// Mongoose types for the kernel's tenancy plugins. Only the kernel's db folder may import the driver
// (ADR-023, lint R28), so the plugins take these names from here.
export type {
  Aggregate as MongooseAggregate,
  Query as MongooseQuery,
  Schema as MongooseSchema,
  SchemaOptions as MongooseSchemaOptions,
} from "mongoose";
