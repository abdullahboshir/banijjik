import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().min(1, 'validation.user.email_required').email('validation.user.email_invalid'),
  password: z.string().min(1, 'validation.common.required'),
});
