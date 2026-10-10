import { DATABASE_KIND, MODEL_TENANCY, type ModelTenancy } from "@banijjik/contracts";
import { Schema } from "mongoose";
import { describe, expect, it } from "vitest";
import { registerModel } from "./model-registry.js";

let issuedNames = 0;

function register(
  schema: Schema,
  tenancy: ModelTenancy,
  database: "PLATFORM" | "TENANT" = DATABASE_KIND.TENANT,
): () => void {
  issuedNames += 1;
  const number = issuedNames;
  return () =>
    registerModel({
      modelName: `CheckedModel${number}`,
      collectionName: `checked_models_${number}`,
      database,
      schema,
      tenancy,
    });
}

function organizationSchema(overrides: { index?: boolean; immutable?: boolean } = {}): Schema {
  const schema = new Schema({
    organizationId: { type: String, required: true, immutable: overrides.immutable ?? true },
    locationId: { type: String, required: true },
  });
  if (overrides.index !== false) schema.index({ organizationId: 1, locationId: 1 });
  return schema;
}

describe("registerModel tenancy checks", () => {
  it("accepts a well-formed ORGANIZATION model", () => {
    expect(register(organizationSchema(), MODEL_TENANCY.ORGANIZATION)).not.toThrow();
  });

  it("accepts a well-formed ORGANIZATION_AND_LOCATION model", () => {
    expect(register(organizationSchema(), MODEL_TENANCY.ORGANIZATION_AND_LOCATION)).not.toThrow();
  });

  it("accepts NONE on the platform database", () => {
    expect(register(new Schema({}), MODEL_TENANCY.NONE, DATABASE_KIND.PLATFORM)).not.toThrow();
  });

  it("refuses NONE on a TENANT-database model", () => {
    const attempt = register(new Schema({}), MODEL_TENANCY.NONE);
    expect(attempt).toThrow(/errors\.invalid_model_definition/);
  });

  it("refuses an ORGANIZATION model without an organizationId path", () => {
    const schema = new Schema({ label: String });
    expect(register(schema, MODEL_TENANCY.ORGANIZATION)).toThrow(/invalid_model_definition/);
  });

  it("refuses an organizationId that is not immutable", () => {
    const attempt = register(organizationSchema({ immutable: false }), MODEL_TENANCY.ORGANIZATION);
    expect(attempt).toThrow(/invalid_model_definition/);
  });

  it("refuses an ORGANIZATION model without an index that starts with organizationId", () => {
    const attempt = register(organizationSchema({ index: false }), MODEL_TENANCY.ORGANIZATION);
    expect(attempt).toThrow(/invalid_model_definition/);
  });

  it("refuses an ORGANIZATION_AND_LOCATION model without a required locationId", () => {
    const schema = new Schema({
      organizationId: { type: String, required: true, immutable: true },
    });
    schema.index({ organizationId: 1 });
    expect(register(schema, MODEL_TENANCY.ORGANIZATION_AND_LOCATION)).toThrow(
      /invalid_model_definition/,
    );
  });
});
