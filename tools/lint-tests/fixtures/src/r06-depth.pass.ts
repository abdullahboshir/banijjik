export function check(options: { first: boolean; second: boolean; third: boolean }): number {
  if (!options.first) {
    return 0;
  }
  if (!options.second) {
    return 0;
  }
  return options.third ? 1 : 0;
}
