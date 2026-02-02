import { IJwtService } from "@iam/application";
import jwt from "jsonwebtoken";
import { appConfig } from "../../../../../config/app.config";

export class JwtService implements IJwtService {
  private readonly secret = appConfig.jwt_access_secret;
  private readonly expiresIn = "1d";

  generateToken(payload: any): string {
    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn });
  }

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.secret);
    } catch (error) {
      return null;
    }
  }
}
