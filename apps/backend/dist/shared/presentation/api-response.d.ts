import { Response } from "express";
/**
 * Global API Response Utilities
 * Platinum Standard: Centralized response orchestration for all controllers.
 */
export declare class ApiResponse {
    static success<T>(res: Response, data: T, message?: string, statusCode?: number): void;
    static paginated<T>(res: Response, data: T[], page: number, limit: number, total: number, message?: string, statusCode?: number): void;
    static error(res: Response, code: string, message: string, statusCode?: number, details?: any, stack?: string): void;
}
//# sourceMappingURL=api-response.d.ts.map