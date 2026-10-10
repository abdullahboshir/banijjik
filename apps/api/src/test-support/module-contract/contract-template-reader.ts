import {
  MODULE_KEY_VALUES,
  OFFERING_KIND,
  type ModuleKey,
  type OfferingKind,
} from "@banijjik/contracts";
import type {
  IndustryTemplateReader,
  IndustryTemplateView,
} from "../../modules/platform/entitlement/index.js";

function permissiveView(templateVersion: number): IndustryTemplateView {
  return {
    allowedModuleKeys: MODULE_KEY_VALUES,
    enabledKinds: Object.values(OFFERING_KIND),
    templateVersion,
  };
}

/**
 * An industry template the suite can change between scenarios. Every change raises the template
 * version, which is part of the config cache key, so the next request resolves again (ADR-091).
 */
export class ContractTemplateReader implements IndustryTemplateReader {
  private view: IndustryTemplateView = permissiveView(0);

  async find(): Promise<IndustryTemplateView> {
    return this.view;
  }

  excludeModule(moduleKey: ModuleKey): void {
    this.replace({
      allowedModuleKeys: this.view.allowedModuleKeys.filter((key) => key !== moduleKey),
    });
  }

  excludeKinds(kinds: readonly OfferingKind[]): void {
    this.replace({ enabledKinds: this.view.enabledKinds.filter((kind) => !kinds.includes(kind)) });
  }

  /** Back to the template that allows every module and kind. */
  reset(): void {
    this.view = permissiveView(this.view.templateVersion + 1);
  }

  private replace(changes: Partial<IndustryTemplateView>): void {
    this.view = { ...this.view, ...changes, templateVersion: this.view.templateVersion + 1 };
  }
}
