/**
 * Profile Response DTO
 * Platinum Standard: Exposes member profile data to the outside world.
 */
export interface ProfileResponseDto {
  profileId: string;
  type: string;
  organizationId: string;
  status: string;
  joinedAt: string;
  metadata: Record<string, any>;
  person: {
    personId: string;
    fullName: string;
    email: string;
    phone?: string;
    bloodGroup?: string;
    fatherName?: string;
    motherName?: string;
    emergencyContact?: string;
    nid?: string;
    permanentAddress?: string;
    currentAddress?: string;
  };
}
