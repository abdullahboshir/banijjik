export interface IssuedApprovalToken {
  readonly token: string;
  readonly tokenHash: string;
}

/** Issues opaque approval tokens and hashes them for storage (ADR-121). */
export interface ApprovalTokenSecrets {
  issue(): IssuedApprovalToken;
  hash(token: string): string;
}
