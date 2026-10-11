/** True when the current path is the entry's page or a page below it. */
export function isOnPath(activePath: string | undefined, href: string): boolean {
  if (activePath === undefined) return false;
  return activePath === href || activePath.startsWith(`${href}/`);
}
