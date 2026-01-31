import { UserThemeType } from "@banijjik/contracts";
export declare class UserSettings {
    private readonly theme;
    private readonly tableHeight;
    private constructor();
    static create(props: {
        theme: UserThemeType;
        tableHeight: string;
    }): UserSettings;
    static default(): UserSettings;
    toObject(): {
        theme: UserThemeType;
        tableHeight: any;
    };
}
//# sourceMappingURL=user-settings.vo.d.ts.map