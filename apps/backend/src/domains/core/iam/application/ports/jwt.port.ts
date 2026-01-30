export interface IJwtService {
  generateToken(payload: any): string;
  verifyToken(token: string): any;
}
