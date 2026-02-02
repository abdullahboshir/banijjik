import { OrganizationCurrencyType } from "@banijjik/contracts";
export interface ILocalizationProps {
    currency: OrganizationCurrencyType;
    language: string;
    timezone: string;
    dateFormat: string;
}
export declare class OrganizationLocalization {
    private readonly props;
    private constructor();
    static create(props: ILocalizationProps): OrganizationLocalization;
    toValue(): ILocalizationProps;
}
//# sourceMappingURL=localization.vo.d.ts.map