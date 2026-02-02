import { Request, Response, NextFunction } from "express";
import { IJwtService } from "../../application/ports/jwt.port.js";
import { IUserRepository } from "../../domain/repositories/user.repository.js";
/**
 * Authentication Middleware Factory
 * Protects routes by verifying JWT tokens and ensuring user existence.
 */
export declare const createAuthenticateMiddleware: (jwtService: IJwtService, userRepository: IUserRepository) => (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=authenticate.middleware.d.ts.map