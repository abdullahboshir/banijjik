/**
 * Writes the platform audit entry for an operator the seed has just created. Called inside the
 * unit of work that inserts the operator. No operator is signed in during a seed, so the adapter
 * lives with the seed and names the new operator as the actor.
 */
export interface SeededOperatorAudit {
  recordSeeded(operator: {
    readonly platformOperatorId: string;
    readonly userId: string;
    readonly platformRoles: readonly string[];
  }): Promise<void>;
}
