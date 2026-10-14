import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import {
  INDUSTRY_TEMPLATE_COLLECTION_NAME,
  INDUSTRY_TEMPLATE_MODEL_NAME,
  industryTemplateSchema,
} from "./industry-template.schema.js";

/** Registers the IndustryTemplate model. Templates are platform configuration (ADR-043, tenancy NONE). */
export function registerIndustryModels(): void {
  registerModel({
    modelName: INDUSTRY_TEMPLATE_MODEL_NAME,
    collectionName: INDUSTRY_TEMPLATE_COLLECTION_NAME,
    database: DATABASE_KIND.PLATFORM,
    schema: industryTemplateSchema,
    tenancy: MODEL_TENANCY.NONE,
  });
}
