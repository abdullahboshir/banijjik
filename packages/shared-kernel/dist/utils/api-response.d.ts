import type { Response } from "express";
export interface IApiResponse<T> {
    success: boolean;
    statusCode: number;
    message: string;
    data?: T;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    timestamp: string;
}
export declare class ApiResponse {
    static success<T>(res: Response, data: T, message?: string, statusCode?: number): void;
    static paginated<T>(res: Response, data: T[], page: number, limit: number, total: number, message?: string, statusCode?: number): void;
    static error(res: Response, message: string, errorCode: string, statusCode?: number): void;
}
//# sourceMappingURL=api-response.d.ts.map