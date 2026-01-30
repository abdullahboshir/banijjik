import { PermissionEffectType } from "@banijjik/contracts";

export class DirectPermission {
  private constructor(
    private readonly permissionId: string,
    private readonly effect: PermissionEffectType,
  ) {}

  static create(props: {
    permissionId: string;
    effect: PermissionEffectType;
  }): DirectPermission {
    if (!props.permissionId) {
      throw new Error("Permission ID required");
    }
    return new DirectPermission(props.permissionId, props.effect);
  }

  toObject() {
    return {
      permissionId: this.permissionId,
      effect: this.effect,
    };
  }
}
