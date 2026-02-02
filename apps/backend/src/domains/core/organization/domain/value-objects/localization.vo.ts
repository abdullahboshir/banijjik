import { OrganizationCurrencyType } from "@banijjik/contracts";

export interface ILocalizationProps {
  currency: OrganizationCurrencyType;
  language: string; // Should ideally use OrganizationLanguageType but contracts might be loose
  timezone: string;
  dateFormat: string;
}

export class OrganizationLocalization {
  private constructor(private readonly props: ILocalizationProps) {}

  public static create(props: ILocalizationProps): OrganizationLocalization {
    // Validation
    return new OrganizationLocalization(props);
  }

  public toValue(): ILocalizationProps {
    return { ...this.props };
  }
}
