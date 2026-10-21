import { registerCreditModels } from "./infrastructure/register-credit-models.js";
import { buildCreditStorefrontRouter } from "./presentation/credit-storefront.router.js";
import { buildCreditTenantRouter } from "./presentation/credit-tenant.router.js";
import {
  MongoCreditRepository,
  MongoCreditPackRepository,
  MongoListingUnlockRepository,
} from "./infrastructure/index.js";
import {
  UnlockListingUseCase,
  GetMyCreditsUseCase,
  GetMyUnlocksUseCase,
  ListCreditPacksUseCase,
  ListActiveCreditPacksUseCase,
  CreateCreditPackUseCase,
  UpdateCreditPackUseCase,
  ArchiveCreditPackUseCase,
  AdjustCreditsUseCase,
  ExpireCreditsUseCase,
} from "./application/index.js";
import { CreditListingUnlockReader } from "./application/adapters/index.js";

export { creditManifest } from "./module.manifest.js";

export {
  registerCreditModels,
  buildCreditStorefrontRouter,
  buildCreditTenantRouter,
  MongoCreditRepository,
  MongoCreditPackRepository,
  MongoListingUnlockRepository,
  UnlockListingUseCase,
  GetMyCreditsUseCase,
  GetMyUnlocksUseCase,
  ListCreditPacksUseCase,
  ListActiveCreditPacksUseCase,
  CreateCreditPackUseCase,
  UpdateCreditPackUseCase,
  ArchiveCreditPackUseCase,
  AdjustCreditsUseCase,
  ExpireCreditsUseCase,
  CreditListingUnlockReader,
};
