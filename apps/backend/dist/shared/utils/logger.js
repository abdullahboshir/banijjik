const isProd = process.env.NODE_ENV === "production";
const LEVEL_VALUE = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
const DEFAULT_LEVEL = isProd ? "info" : "debug";
const COLORS = {
    debug: "\x1b[36m", // cyan
    info: "\x1b[32m", // green
    warn: "\x1b[33m", // yellow
    error: "\x1b[31m", // red
};
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const BRIGHT = "\x1b[1m";
/**
 * Extract caller information from stack trace at CALL TIME
 */
function getCallerInfo() {
    try {
        const oldPrepareStackTrace = Error.prepareStackTrace;
        Error.prepareStackTrace = (_err, stack) => stack;
        const err = new Error();
        const stack = err.stack || [];
        Error.prepareStackTrace = oldPrepareStackTrace;
        if (!Array.isArray(stack)) {
            return { file: "unknown", line: "0", full: "[unknown:0]" };
        }
        // Skip logger internals and node surroundings
        for (let i = 1; i < stack.length; i++) {
            const frame = stack[i];
            const filename = frame.getFileName() || "";
            if (filename.includes("logger.ts") ||
                filename.includes("node:internal") ||
                filename.includes("node_modules")) {
                continue;
            }
            const lineNumber = frame.getLineNumber() || 0;
            const columnNumber = frame.getColumnNumber() || 0;
            if (filename) {
                const projectRoot = process.cwd();
                const relativePath = filename
                    .replace(projectRoot, "")
                    .replace(/^[/\\]/, "")
                    .replace(/\\/g, "/");
                const segments = relativePath.split("/");
                const shortPath = segments.length > 3
                    ? `.../${segments.slice(-3).join("/")}`
                    : relativePath;
                return {
                    file: shortPath,
                    line: String(lineNumber),
                    full: `${shortPath}:${lineNumber}:${columnNumber}`,
                };
            }
        }
    }
    catch (e) {
        // Silent fail
    }
    return { file: "unknown", line: "0", full: "unknown:0:0" };
}
/**
 * Sanitize sensitive data in logs (production only)
 */
function sanitizeSensitive(data) {
    if (!isProd)
        return data;
    if (data == null || typeof data !== "object")
        return data;
    const clone = Array.isArray(data) ? [] : {};
    const sensitiveKeys = [
        "password",
        "token",
        "accessToken",
        "refreshToken",
        "secret",
        "apiKey",
        "authorization",
        "cookie",
    ];
    for (const key in data) {
        const val = data[key];
        if (sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
            clone[key] = "***REDACTED***";
        }
        else if (typeof val === "object" && val !== null) {
            clone[key] = sanitizeSensitive(val);
        }
        else {
            clone[key] = val;
        }
    }
    return clone;
}
/**
 * Core logging function
 */
function logAtLevel(level, msg, meta) {
    const currentLevelValue = LEVEL_VALUE[DEFAULT_LEVEL];
    const thisLevelValue = LEVEL_VALUE[level];
    if (thisLevelValue < currentLevelValue)
        return;
    const callerInfo = getCallerInfo();
    const timestamp = new Date().toISOString();
    const sanitizedMeta = sanitizeSensitive(meta || {});
    if (isProd) {
        const payload = {
            timestamp,
            level: level.toUpperCase(),
            location: callerInfo.full,
            message: msg,
            ...(Object.keys(sanitizedMeta).length > 0 && { meta: sanitizedMeta }),
        };
        console.log(JSON.stringify(payload));
    }
    else {
        const color = COLORS[level];
        const levelTag = `${color}${BRIGHT}${level.toUpperCase().padEnd(5)}${RESET}`;
        const timeTag = `${DIM}${timestamp}${RESET}`;
        const fileTag = `${BRIGHT}[${callerInfo.full}]${RESET}`;
        let metaString = "";
        if (Object.keys(sanitizedMeta).length > 0) {
            metaString = "\n" + JSON.stringify(sanitizedMeta, null, 2);
        }
        const logLine = `${timeTag} ${levelTag} ${fileTag}\n  → ${msg}${metaString}`;
        if (level === "error") {
            console.error(logLine);
        }
        else if (level === "warn") {
            console.warn(logLine);
        }
        else {
            console.log(logLine);
        }
    }
}
export const logger = {
    debug: (msg, meta) => logAtLevel("debug", msg, meta),
    info: (msg, meta) => logAtLevel("info", msg, meta),
    warn: (msg, meta) => logAtLevel("warn", msg, meta),
    error: (msg, meta) => logAtLevel("error", msg, meta),
};
//# sourceMappingURL=logger.js.map