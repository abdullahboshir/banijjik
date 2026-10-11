"use client";

import type { ModuleClass, ModuleKey } from "@banijjik/contracts";
import { Checkbox } from "@banijjik/ui";
import type { ReactElement } from "react";
import { PACKAGE_MODULE_CLASSES, modulesOfClass } from "./module-catalog";
import { withModule } from "./package-draft";

export interface ModulePickerProps {
  legend: string;
  selected: ModuleKey[];
  moduleLabels: Record<ModuleKey, string>;
  classLabels: Record<ModuleClass, string>;
  isReadOnly: boolean;
  onChange: (moduleKeys: ModuleKey[]) => void;
}

/** The modules of a package as checkboxes, grouped by module class (CORE and OPTIONAL can be sold). */
export function ModulePicker(props: ModulePickerProps): ReactElement {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-small font-semibold text-primary">{props.legend}</legend>
      {PACKAGE_MODULE_CLASSES.map((moduleClass) => (
        <div key={moduleClass}>
          <h3 className="text-caption text-secondary">{props.classLabels[moduleClass]}</h3>
          <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
            {modulesOfClass(moduleClass).map((moduleKey) => (
              <Checkbox
                key={moduleKey}
                label={props.moduleLabels[moduleKey]}
                checked={props.selected.includes(moduleKey)}
                disabled={props.isReadOnly}
                onChange={(event) =>
                  props.onChange(withModule(props.selected, moduleKey, event.target.checked))
                }
              />
            ))}
          </div>
        </div>
      ))}
    </fieldset>
  );
}
