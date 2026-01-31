import { Request, Response } from "express";
export declare class StorefrontController {
    /**
     * getPublicStorefront
     * Fetches storefront data by slug for the public website.
     */
    static getPublicStorefront(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * getAdminStorefront
     * Fetches storefront data for the organization admin dashboard.
     */
    static getAdminStorefront(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * updateStorefront
     * Updates storefront settings and sections.
     */
    static updateStorefront(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
//# sourceMappingURL=storefront.controller.d.ts.map