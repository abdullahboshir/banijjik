/**
 * POS (card 3.9) request schemas (`@banijjik/validation/pos`).
 * Kept off the root index so that file stays within the line limit.
 */
export {
  posCatalogSnapshotQuerySchema,
  posDeviceCreateRequestSchema,
  posDeviceIdParamsSchema,
  posDeviceListQuerySchema,
  posDevicePairRequestSchema,
  posDeviceRevokeRequestSchema,
  posSaleRequestSchema,
  posSessionCloseRequestSchema,
  posSessionIdParamsSchema,
  posSessionOpenRequestSchema,
  type PosCatalogSnapshotQuery,
  type PosDeviceCreateBody,
  type PosDeviceListQuery,
  type PosDevicePairBody,
  type PosDeviceRevokeBody,
  type PosSaleBody,
  type PosSessionCloseBody,
  type PosSessionOpenBody,
} from "./pos-schemas.js";
