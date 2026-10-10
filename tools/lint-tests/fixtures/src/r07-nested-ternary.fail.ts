export function label(first: boolean, second: boolean): string {
  return first ? (second ? "both" : "first") : "none";
}
