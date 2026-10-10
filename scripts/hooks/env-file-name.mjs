const ENV_FILE_NAME = /^\.env(\..+)?$/;
const ALLOWED_ENV_FILE_NAME = ".env.example";
// Windows ignores trailing dots and spaces in a file name, so ".env." and ".env " open the file ".env".
const TRAILING_DOTS_AND_SPACES = /[. ]+$/;

/**
 * True for ".env", ".env.local", ".env.production" and so on, but not ".env.example". The name is
 * lower-cased and its trailing dots and spaces are removed first, because on Windows ".ENV",
 * ".env." and ".env " are all the same file as ".env" (review finding M7).
 */
export function isBlockedEnvFileName(fileName) {
  const normalizedName = fileName.toLowerCase().replace(TRAILING_DOTS_AND_SPACES, "");
  return ENV_FILE_NAME.test(normalizedName) && normalizedName !== ALLOWED_ENV_FILE_NAME;
}

/** Same check for a path with either kind of separator (path.basename on Linux would not split backslashes). */
export function isBlockedEnvPath(filePath) {
  const fileName = filePath.split(/[\\/]/).pop() ?? "";
  return isBlockedEnvFileName(fileName);
}
