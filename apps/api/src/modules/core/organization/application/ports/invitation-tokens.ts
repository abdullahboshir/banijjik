export interface IssuedInvitationToken {
  /** The secret for the link; shown once, never stored. */
  readonly token: string;
  readonly tokenHash: string;
}

export interface InvitationTokens {
  issue(): IssuedInvitationToken;
  hash(token: string): string;
}
