import jwt from "jsonwebtoken";
import { appConfig } from "../../../../../config/app.config";
export class JwtService {
    constructor() {
        this.secret = appConfig.jwt_access_secret;
        this.expiresIn = "1d";
    }
    generateToken(payload) {
        return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn });
    }
    verifyToken(token) {
        try {
            return jwt.verify(token, this.secret);
        }
        catch (error) {
            return null;
        }
    }
}
//# sourceMappingURL=jwt.service.js.map