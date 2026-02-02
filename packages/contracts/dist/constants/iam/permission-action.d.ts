export declare const PERMISSION_ACTION_ENUM: readonly ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE", "REJECT", "MANAGE", "VIEW", "ASSIGN", "PUBLISH", "UNPUBLISH", "VERIFY", "CANCEL", "ACTIVATE", "DEACTIVATE", "REFUND", "BLOCK", "UNBLOCK", "SUSPEND", "UNSUSPEND", "RESTRICT", "UNRESTRICT", "EXPORT", "IMPORT", "ESCALATE"];
export type PermissionActionType = (typeof PERMISSION_ACTION_ENUM)[number];
export declare const PERMISSION_ACTION: any;
export declare const PERMISSION_SENSITIVE_ACTION_ENUM: readonly PermissionActionType[];
export type PermissionSensitiveActionType = (typeof PERMISSION_SENSITIVE_ACTION_ENUM)[number];
export declare const PERMISSION_SENSITIVE_ACTION: any;
//# sourceMappingURL=permission-action.d.ts.map