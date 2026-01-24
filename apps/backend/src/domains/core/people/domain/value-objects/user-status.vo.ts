/**
 * User Status Value Object
 * Defines the status of a user/person in the domain.
 * Pure Domain implementation, decoupled from API contracts.
 */
export enum UserStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED',
}
