import { Request, Response } from 'express';
import { RegisterUserHandler, LoginHandler } from '@identity/application';
import { CreateUserSchema, LoginSchema } from '@banijjik/validation';

export class UserController {
  constructor(
    private readonly registerUserHandler: RegisterUserHandler,
    private readonly loginHandler: LoginHandler
  ) {}

  async create(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = CreateUserSchema.parse(req.body);
      const result = await this.registerUserHandler.handle(validatedData as any);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Server Error',
      });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = LoginSchema.parse(req.body);
      const result = await this.loginHandler.handle(validatedData as any);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        error: error.message || 'Unauthorized',
      });
    }
  }
}