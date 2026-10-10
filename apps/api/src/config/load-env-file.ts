/** Loads KEY=VALUE pairs from a file into process.env if the file exists. Missing file is not an error. */
export function loadEnvFile(path: string): void {
  try {
    // Node does not override variables that are already set.
    process.loadEnvFile(path);
  } catch (error) {
    if (isMissingFile(error)) return;
    throw error;
  }
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
