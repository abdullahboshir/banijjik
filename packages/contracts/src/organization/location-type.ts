import { defineEnum } from "../define-enum.js";

/** A WAREHOUSE holds stock only: no POS, no bookings, no walk-in sales (09-DOMAIN-MODEL section 4.3). */
export const LOCATION_TYPE = defineEnum(["STORE", "WAREHOUSE"]);

export type LocationType = (typeof LOCATION_TYPE)[keyof typeof LOCATION_TYPE];
