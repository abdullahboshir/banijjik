import { tmpdir } from "node:os";
import { join } from "node:path";
import type { StorageConfig } from "./app-config.js";
import {
  allowLocalServicesRule,
  FILE_STORAGE_LOCAL_IN_PRODUCTION_HINT,
  fileStorageAccessKeyIdRule,
  fileStorageBucketRule,
  fileStorageDriverRule,
  fileStorageEndpointRule,
  fileStorageLocalPathRule,
  fileStorageRegionRule,
  fileStorageSecretAccessKeyRule,
  isTestEnvironment,
} from "./env.schema.js";
import type { ConfigSection } from "./read-auth-config.js";
import { collectIssues, readField, readOptionalField, type Environment } from "./read-field.js";

const DEVELOPMENT_UPLOAD_FOLDER = "platform-uploads";

/** Same rule as the database URLs: only CI or the test runner may play production on local services. */
function mayUseLocalServices(env: Environment): boolean {
  const flag = readField(env, allowLocalServicesRule);
  return flag.value === true && isTestEnvironment(env);
}

function readLocalStorage(env: Environment, isProduction: boolean): ConfigSection<StorageConfig> {
  if (isProduction && !mayUseLocalServices(env)) {
    return {
      issues: [
        {
          key: fileStorageDriverRule.key,
          problem: "INVALID",
          hint: FILE_STORAGE_LOCAL_IN_PRODUCTION_HINT,
        },
      ],
    };
  }
  const localRoot = readField(env, {
    ...fileStorageLocalPathRule,
    defaultValue: join(tmpdir(), DEVELOPMENT_UPLOAD_FOLDER),
  });
  const issues = collectIssues([localRoot]);
  if (localRoot.value === undefined) return { issues };
  return { issues, value: Object.freeze({ driver: "local", localRoot: localRoot.value }) };
}

function readObjectStorage(env: Environment): ConfigSection<StorageConfig> {
  const bucket = readField(env, fileStorageBucketRule);
  const region = readField(env, fileStorageRegionRule);
  const endpoint = readOptionalField(env, fileStorageEndpointRule);
  const accessKeyId = readField(env, fileStorageAccessKeyIdRule);
  const secretAccessKey = readField(env, fileStorageSecretAccessKeyRule);
  const issues = collectIssues([bucket, region, endpoint, accessKeyId, secretAccessKey]);
  if (
    issues.length > 0 ||
    bucket.value === undefined ||
    region.value === undefined ||
    accessKeyId.value === undefined ||
    secretAccessKey.value === undefined
  ) {
    return { issues };
  }
  return {
    issues,
    value: Object.freeze({
      driver: "s3",
      bucket: bucket.value,
      region: region.value,
      accessKeyId: accessKeyId.value,
      secretAccessKey: secretAccessKey.value,
      ...(endpoint.value === undefined ? {} : { endpoint: endpoint.value }),
    }),
  };
}

/** Where uploaded files live (card 3.0). Production needs the object store; no credential is ever printed. */
export function readStorageConfig(
  env: Environment,
  isProduction: boolean,
): ConfigSection<StorageConfig> {
  const driver = readField(env, fileStorageDriverRule);
  if (driver.value === undefined) return { issues: collectIssues([driver]) };
  if (driver.value === "s3") return readObjectStorage(env);
  return readLocalStorage(env, isProduction);
}
