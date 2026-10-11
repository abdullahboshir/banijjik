import type { Labels } from "../lib/labels";

export const REMOVE_OVERRIDE_LABEL_KEYS = [
  "platform.override.remove",
  "platform.override.removeTitle",
  "platform.override.removeDescription",
  "platform.override.removed",
] as const;

export type RemoveOverrideLabels = Labels<(typeof REMOVE_OVERRIDE_LABEL_KEYS)[number]>;
