import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import {
  PLATFORM_OPERATOR_COLLECTION_NAME,
  PLATFORM_OPERATOR_MODEL_NAME,
  platformOperatorSchema,
} from "./platform-operator.schema.js";
import {
  REFRESH_SESSION_COLLECTION_NAME,
  REFRESH_SESSION_MODEL_NAME,
  refreshSessionSchema,
} from "./refresh-session.schema.js";
import { ROLE_COLLECTION_NAME, ROLE_MODEL_NAME, roleSchema } from "./role.schema.js";
import { USER_COLLECTION_NAME, USER_MODEL_NAME, userSchema } from "./user.schema.js";

/** Registers the iam models (users, sessions, operators, roles). They live in the platform database: identity is not tenant data (ADR-043). */
export function registerIamModels(): void {
  registerModel({
    modelName: USER_MODEL_NAME,
    collectionName: USER_COLLECTION_NAME,
    database: DATABASE_KIND.PLATFORM,
    schema: userSchema,
    tenancy: MODEL_TENANCY.NONE,
  });
  registerModel({
    modelName: REFRESH_SESSION_MODEL_NAME,
    collectionName: REFRESH_SESSION_COLLECTION_NAME,
    database: DATABASE_KIND.PLATFORM,
    schema: refreshSessionSchema,
    tenancy: MODEL_TENANCY.NONE,
  });
  registerModel({
    modelName: PLATFORM_OPERATOR_MODEL_NAME,
    collectionName: PLATFORM_OPERATOR_COLLECTION_NAME,
    database: DATABASE_KIND.PLATFORM,
    schema: platformOperatorSchema,
    tenancy: MODEL_TENANCY.NONE,
  });
  registerModel({
    modelName: ROLE_MODEL_NAME,
    collectionName: ROLE_COLLECTION_NAME,
    database: DATABASE_KIND.PLATFORM,
    schema: roleSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
}
