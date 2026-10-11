import type { Translator } from "@banijjik/i18n";

/**
 * The name to show for a package: the translated `nameKey` of a seed package, the plain `name` of an
 * operator-made one, and the key itself when neither is available (a catalogue without text for the key).
 */
export function packageDisplayName(
  pkg: { packageKey: string; nameKey: string | null; name: string | null },
  translator: Pick<Translator, "t" | "has">,
): string {
  if (pkg.nameKey !== null && translator.has(pkg.nameKey)) return translator.t(pkg.nameKey);
  return pkg.name ?? pkg.packageKey;
}
