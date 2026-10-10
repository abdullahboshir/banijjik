export const MAX_ATTEMPTS: number = 3;
export const retryDelayMs: number = 100;
export const OrderSchema: string = "order";

export function makeValue(): number {
  return MAX_ATTEMPTS + retryDelayMs;
}

export interface OrderShape {
  name: string;
}

export type OrderKey = keyof OrderShape;
