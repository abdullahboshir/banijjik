import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  type AuditChanges,
  type AuditValue,
} from "@banijjik/contracts";
import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import type { PreparedSettingChange } from "./prepare-setting-change.js";

export interface SettingAuditChange {
  readonly change: PreparedSettingChange;
  readonly from: unknown;
  readonly to: unknown;
}

/** Structured values become JSON because audit fields only hold primitives (ADR-089). */
function auditValue(value: unknown): AuditValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return JSON.stringify(value);
}

function fieldKey(change: PreparedSettingChange): string {
  if (change.locationId === null) return change.settingKey;
  return `${change.settingKey}@${change.locationId}`;
}

export function settingAuditChanges(applied: readonly SettingAuditChange[]): AuditChanges {
  const changes: Record<string, { from: AuditValue; to: AuditValue }> = {};
  for (const entry of applied) {
    changes[fieldKey(entry.change)] = { from: auditValue(entry.from), to: auditValue(entry.to) };
  }
  return changes;
}

/** One entry for the whole batch. `entityId` is the organization, because a batch can span keys. */
export async function recordSettingChange(
  audit: AuditRecorder,
  organizationId: string,
  applied: readonly SettingAuditChange[],
): Promise<void> {
  await audit.record({
    action: AUDIT_ACTION.SETTING_CHANGED,
    entityType: AUDIT_ENTITY_TYPE.setting,
    entityId: organizationId,
    changes: settingAuditChanges(applied),
  });
}
