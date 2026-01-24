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

export class ApiResponse {
  static success<T>(
    res: Response,
    data: T,
    message: string = "Success",
    statusCode: number = 200
  ): void {
    const response: IApiResponse<T> = {
      success: true,
      statusCode,
      message,
      data,
      timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(response);
  }

  static paginated<T>(
    res: Response,
    data: T[],
    page: number,
    limit: number,
    total: number,
    message: string = "Success",
    statusCode: number = 200
  ): void {
    const totalPages = Math.ceil(total / limit);
    const response: IApiResponse<T[]> = {
      success: true,
      statusCode,
      message,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(response);
  }

  static error(
    res: Response,
    message: string,
    errorCode: string,
    statusCode: number = 500
  ): void {
    const response = {
      success: false,
      statusCode,
      errorCode,
      message,
      timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(response);
  }
}
