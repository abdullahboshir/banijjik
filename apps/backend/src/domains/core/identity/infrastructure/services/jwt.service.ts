import { IJwtService } from '@identity/application';
import * as jwt from 'jsonwebtoken';

export class JwtService implements IJwtService {
  private readonly secret = process.env.JWT_SECRET || 'super-secret-key';
  private readonly expiresIn = '1d';

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
