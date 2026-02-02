import { Express } from "express";
/**
 * ServerBootstrap - Clean DDD
 * Responsible for configuring global middleware and request pipeline.
 * This class follows the Single Responsibility Principle.
 */
export declare class ServerBootstrap {
    private static instance;
    private constructor();
    static getInstance(): ServerBootstrap;
    /**
     * Initialize all global middleware on the Express app.
     */
    initialize(app: Express): void;
    /**
     * Setup global error handling middleware.
     * This should be called AFTER all routes are mounted.
     */
    setupErrorHandling(app: Express): void;
}
/**
 * Function export for compatibility with bootstrap runner.
 */
export declare function bootstrapServer(_app: Express): Promise<void>;
//# sourceMappingURL=server.bootstrap.d.ts.map