import { Request, Response } from "express";
import { StorefrontRepositoryImpl } from "../../infrastructure/persistence/mongoose/repositories/storefront.repository.impl";
import { GetStorefrontUseCase } from "../../application/use-cases/get-storefront.use-case";
import { UpdateStorefrontUseCase } from "../../application/use-cases/update-storefront.use-case";
import { SetupStorefrontUseCase } from "../../application/use-cases/setup-storefront.use-case";
import { MongooseOrganizationRepository } from "../../../organization/infrastructure/persistence/mongoose/repositories/organization.repository.impl";

const storefrontRepo = new StorefrontRepositoryImpl();
const organizationRepo = new MongooseOrganizationRepository();

const getStorefrontUseCase = new GetStorefrontUseCase(storefrontRepo);
const updateStorefrontUseCase = new UpdateStorefrontUseCase(storefrontRepo);
const setupStorefrontUseCase = new SetupStorefrontUseCase(
  storefrontRepo,
  organizationRepo,
);

export class StorefrontController {
  /**
   * getPublicStorefront
   * Fetches storefront data by slug for the public website.
   */
  static async getPublicStorefront(req: Request, res: Response) {
    const { slug } = req.params;
    if (typeof slug !== "string") {
      return res.status(400).json({ message: "Invalid slug" });
    }
    const storefront = await getStorefrontUseCase.executeBySlug(slug);

    if (!storefront) {
      return res.status(404).json({ message: "Storefront not found" });
    }

    res.status(200).json(storefront.toPrimitives());
  }

  /**
   * getAdminStorefront
   * Fetches storefront data for the organization admin dashboard.
   */
  static async getAdminStorefront(req: Request, res: Response) {
    const organizationId = (req as any).user?.organization; // Explicit cast to avoid lint error
    if (!organizationId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No organization context" });
    }

    let storefront =
      await getStorefrontUseCase.executeByOrganization(organizationId);

    // Lazy initialization if not exists
    if (!storefront) {
      const organization = await organizationRepo.findById(organizationId);
      if (organization) {
        storefront = await setupStorefrontUseCase.execute(
          organizationId,
          organization.slug, // Using organization slug as initial storefront slug
        );
      }
    }

    if (!storefront) {
      return res.status(404).json({ message: "Storefront not found" });
    }

    res.status(200).json(storefront.toPrimitives());
  }

  /**
   * updateStorefront
   * Updates storefront settings and sections.
   */
  static async updateStorefront(req: Request, res: Response) {
    const organizationId = (req as any).user?.organization;
    if (!organizationId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No organization context" });
    }

    const updated = await updateStorefrontUseCase.execute(
      organizationId,
      req.body,
    );
    res.status(200).json(updated.toPrimitives());
  }
}
