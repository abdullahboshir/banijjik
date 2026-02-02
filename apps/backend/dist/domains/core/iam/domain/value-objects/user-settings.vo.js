import { USER_THEME, TABLE_HEIGHT, } from "@banijjik/contracts";
export class UserSettings {
    constructor(theme, tableHeight) {
        this.theme = theme;
        this.tableHeight = tableHeight;
    }
    static create(props) {
        return new UserSettings(props.theme, props.tableHeight);
    }
    static default() {
        return new UserSettings(USER_THEME.SYSTEM, TABLE_HEIGHT.MEDIUM);
    }
    toObject() {
        return {
            theme: this.theme,
            tableHeight: this.tableHeight,
        };
    }
}
//# sourceMappingURL=user-settings.vo.js.map