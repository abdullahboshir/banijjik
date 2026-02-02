import { IJwtService } from "@iam/application";
export declare class JwtService implements IJwtService {
    private readonly secret;
    private readonly expiresIn;
    generateToken(payload: any): string;
    verifyToken(token: string): any;
}
//# sourceMappingURL=jwt.service.d.ts.map