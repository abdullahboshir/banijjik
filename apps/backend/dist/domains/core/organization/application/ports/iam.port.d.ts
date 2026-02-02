export interface IOwnerCreationDetails {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    organizationId: string;
}
export interface IIamService {
    registerOrganizationOwner(details: IOwnerCreationDetails): Promise<{
        userId: string;
        token: string;
    }>;
}
//# sourceMappingURL=iam.port.d.ts.map