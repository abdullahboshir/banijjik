import {
  USER_THEME,
  UserThemeType,
  TABLE_HEIGHT,
  TableHeightType,
} from "@banijjik/contracts";

export class UserSettings {
  private constructor(
    private readonly theme: UserThemeType,
    private readonly tableHeight: TableHeightType | string,
  ) {}

  static create(props: {
    theme: UserThemeType;
    tableHeight: string;
  }): UserSettings {
    return new UserSettings(props.theme, props.tableHeight);
  }

  static default(): UserSettings {
    return new UserSettings(USER_THEME.SYSTEM, TABLE_HEIGHT.MEDIUM);
  }

  toObject() {
    return {
      theme: this.theme,
      tableHeight: this.tableHeight,
    };
  }
}
