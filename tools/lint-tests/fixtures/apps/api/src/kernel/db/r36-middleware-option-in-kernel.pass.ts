export function allowsTheOption(options: { middleware?: boolean }): boolean {
  return options.middleware !== false;
}
