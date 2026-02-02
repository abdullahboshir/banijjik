import {
  DeploymentType,
  OrganizationStorageProviderType,
  DEPLOYMENT_TYPE_ENUM,
} from "@banijjik/contracts";

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

export class OrganizationDeployment {
  private constructor(private readonly props: IDeploymentProps) {}

  // Registry for type-safe access without hardcoded strings
  private static readonly registry: Record<DeploymentType, DeploymentType> =
    (() => {
      const map = {} as Record<DeploymentType, DeploymentType>;
      for (const type of DEPLOYMENT_TYPE_ENUM) {
        map[type] = type;
      }
      return map;
    })();

  static get VALUE(): Readonly<typeof OrganizationDeployment.registry> {
    return this.registry;
  }

  public static create(props: IDeploymentProps): OrganizationDeployment {
    return new OrganizationDeployment(props);
  }

  public toValue(): IDeploymentProps {
    return { ...this.props };
  }
}
