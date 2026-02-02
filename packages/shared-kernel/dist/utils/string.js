/**
 * Pure Utility: Generate a URL-friendly slug from a string.
 * This can be safely used in both Frontend and Backend.
 */
export function makeSlug(name) {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}
//# sourceMappingURL=string.js.map