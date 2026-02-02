export interface BillingAccountResponseDto {
  billingAccountId: string;
  ownerId: string;
  ownerType: string;
  currency: string;
  balance: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
