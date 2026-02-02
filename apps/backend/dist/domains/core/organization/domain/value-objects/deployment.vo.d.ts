import { DeploymentType, OrganizationStorageProviderType } from "@banijjik/contracts";
export interface IDeploymentProps {
    type: DeploymentType;
    customDomain?: string;
    databaseUri?: string;
    serverRegion?: string;
    dbCluster?: string;
    customEnv?: Record<string, any>;
    storageConfig?: {
        provider: OrganizationStorageProviderType;
        bucket?: string;
        region?: string;
    };
}
export declare class OrganizationDeployment {
    private readonly props;
    private constructor();
    private static readonly registry;
    static get VALUE(): Readonly<typeof OrganizationDeployment.registry>;
    static create(props: IDeploymentProps): OrganizationDeployment;
    toValue(): IDeploymentProps;
}
//# sourceMappingURL=deployment.vo.d.ts.map