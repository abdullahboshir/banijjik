import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import compression from "compression";
import morgan from "morgan";
import { appConfig } from "../config/app.config";

/**
 * ServerBootstrap - Clean DDD
 * Responsible for configuring global middleware and request pipeline.
 * This class follows the Single Responsibility Principle.
 */
export class ServerBootstrap {
  private static instance: ServerBootstrap;

  private constructor() {}

  public static getInstance(): ServerBootstrap {
    if (!ServerBootstrap.instance) {
      ServerBootstrap.instance = new ServerBootstrap();
    }
    return ServerBootstrap.instance;
  }

  /**
   * Initialize all global middleware on the Express app.
   */
  public initialize(app: Express): void {
    // 1. Security Headers
    app.use(helmet());

    // 2. CORS
    app.use(
      cors({
        origin: appConfig.cors_origin,
        credentials: true,
      }),
    );

    // 3. Body Parsing
    app.use(express.json({ limit: appConfig.max_upload_size }));
    app.use(
      express.urlencoded({ extended: true, limit: appConfig.max_upload_size }),
    );

    // 4. Cookie Parsing
    app.use(cookieParser(appConfig.cookie_secret));

    // 5. Compression
    app.use(compression());

    // 6. Request Logging (Only in development)
    if (appConfig.NODE_ENV === "development") {
      app.use(morgan("dev"));
    }

    // 7. Trust Proxy (For production behind a reverse proxy)
    if (appConfig.trust_proxy) {
      app.set("trust proxy", 1);
    }

    console.log("⚙️  Global middleware initialized");
  }

  /**
   * Setup global error handling middleware.
   * This should be called AFTER all routes are mounted.
   */
  public setupErrorHandling(app: Express): void {
    // 404 Handler
    app.use((_req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        message: "Resource not found",
      });
    });

    // Global Error Handler
    app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      console.error("🔥 Global Error:", err.message);
      res.status(500).json({
        success: false,
        message:
          appConfig.NODE_ENV === "production"
            ? "Internal Server Error"
            : err.message,
      });
    });

    console.log("🛡️  Error handlers registered");
  }
}

/**
 * Function export for compatibility with bootstrap runner.
 */
export async function bootstrapServer(_app: Express): Promise<void> {
  console.log("⚙️  Server bootstrap logic prepared (Ready to listen)");
}
