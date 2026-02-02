export interface AuthenticatedUser {
  userId: string;
  email: string;
  roles: string[];
  organizationId?: string;
  isSuperAdmin: boolean;
}
