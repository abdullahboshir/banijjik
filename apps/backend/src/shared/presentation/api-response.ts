import { Response } from "express";
import { ApiResponse as IApiResponse } from "@banijjik/contracts";

/**
 * Global API Response Utilities
 * Platinum Standard: Centralized response orchestration for all controllers.
 */
export class ApiResponse {
  static success<T>(
    res: Response,
    data: T,
    message?: string,
    statusCode: number = 200,
  ): void {
    const response: IApiResponse<T> = {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        message,
      },
    };

    res.status(statusCode).json(response);
  }

  static paginated<T>(
    res: Response,
    data: T[],
    page: number,
    limit: number,
    total: number,
    message?: string,
    statusCode: number = 200,
  ): void {
    const totalPages = Math.ceil(total / limit);
    const response: IApiResponse<T[]> = {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        message,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
    };

    res.status(statusCode).json(response);
  }

  static error(
    res: Response,
    code: string,
    message: string,
    statusCode: number = 500,
    details?: any,
    stack?: string,
  ): void {
    const response: IApiResponse = {
      success: false,
      error: {
        code,
        message,
        details,
        stack,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };

    res.status(statusCode).json(response);
  }
}
