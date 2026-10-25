/** Events of the POS module (`<module>.<entity>.<pastTenseVerb>`, plan 3.9). */
export const POS_EVENT_TYPE = Object.freeze({
  REGISTER_CLOSED: "pos.register.closed",
} as const);

export type PosEventType = (typeof POS_EVENT_TYPE)[keyof typeof POS_EVENT_TYPE];

export interface PosRegisterClosedPayload {
  readonly posSessionId: string;
}
