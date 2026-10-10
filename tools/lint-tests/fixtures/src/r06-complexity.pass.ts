export function classify(input: number): string {
  if (input === 1) {
    return "one";
  }
  if (input === 2) {
    return "two";
  }
  return "other";
}
