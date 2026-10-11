import { useEffect, useState, type ComponentType } from "react";

/**
 * Loads a component's code on first need and keeps it. Sheets, dialogs and forms are used only after a tap,
 * so their code stays out of the first load of the route (13-UX section 11). Server rendering stays on (ADR-010):
 * the first render shows nothing in the component's place.
 */
export function useLazyComponent<Props>(
  load: () => Promise<ComponentType<Props>>,
  isNeeded: boolean,
): ComponentType<Props> | null {
  const [Component, setComponent] = useState<ComponentType<Props> | null>(null);
  useEffect(() => {
    if (!isNeeded || Component) return;
    async function run(): Promise<void> {
      const loaded = await load();
      setComponent(() => loaded);
    }
    void run();
  }, [isNeeded, Component, load]);
  return Component;
}
