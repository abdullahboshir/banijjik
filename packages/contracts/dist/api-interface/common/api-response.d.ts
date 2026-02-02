/**
 * Global API Response Structure
 * Platinum Standard: Unified communication between all services.
 */
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
        stack?: string;
    };
    meta?: {
        timestamp: string;
        requestId?: string;
        pagination?: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
        [key: string]: any;
    };
}
//# sourceMappingURL=api-response.d.ts.map