/**
 * Profile Response DTO
 * Platinum Standard: Exposes member profile data to the outside world.
 */
export interface ProfileResponseDto {
    id: string;
    type: string;
    organizationId: string;
    status: string;
    joinedAt: string;
    metadata: Record<string, any>;
    person: {
        id: string;
        fullName: string;
        email: string;
    };
}
//# sourceMappingURL=profile.response.d.ts.map