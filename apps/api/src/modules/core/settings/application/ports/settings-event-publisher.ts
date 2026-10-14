import type { EventPayloadMap, SettingsEventType } from "@banijjik/contracts";

/** Writes `settings.setting.changed` in the same transaction as the batch (ADR-090). */
export interface SettingsEventPublisher {
  publish<Type extends SettingsEventType>(
    type: Type,
    payload: EventPayloadMap[Type],
  ): Promise<void>;
}
