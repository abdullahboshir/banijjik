import { Location } from "../../domain/location.entity.js";
import { type AuditFields } from "../../../../../kernel/audit/index.js";

export function auditFieldsOf(location: Location): AuditFields {
  return {
    name: location.name,
    locationType: location.locationType,
    status: location.status,
    phoneE164: location.phoneE164,
    timezone: location.timezone,
    "address.line1": location.address?.line1,
    "address.area": location.address?.area,
    "address.thana": location.address?.thana,
    "address.district": location.address?.district,
    "address.postalCode": location.address?.postalCode,
  };
}
