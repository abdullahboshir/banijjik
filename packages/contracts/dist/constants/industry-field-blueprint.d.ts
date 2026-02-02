export interface IFieldDefinition {
    key: string;
    label: string;
    type: "string" | "number" | "date" | "enum" | "boolean";
    required: boolean;
    options?: string[];
    placeholder?: string;
    description?: string;
}
export type IndustryBlueprint = Record<string, IFieldDefinition[]>;
export declare const INDUSTRY_BLUEPRINTS: IndustryBlueprint;
//# sourceMappingURL=industry-field-blueprint.d.ts.map