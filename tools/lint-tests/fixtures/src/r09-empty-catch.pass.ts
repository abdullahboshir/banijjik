export function parseOrFail(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error("Invalid JSON", { cause: error });
  }
}
