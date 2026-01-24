/**
 * Platform Capabilities
 * Platinum Standard: Shared identifiers for feature flags and permissions.
 */
export declare const Capabilities: {
    readonly CORE_IDENTITY: "core:identity";
    readonly CORE_PEOPLE: "core:people";
    readonly PLATFORM_BILLING: "platform:billing";
    readonly CUSTOM_ORDERING: "custom:ordering";
    readonly CUSTOM_INVENTORY: "custom:inventory";
};
export type Capability = typeof Capabilities[keyof typeof Capabilities];
//# sourceMappingURL=capabilities.d.ts.map