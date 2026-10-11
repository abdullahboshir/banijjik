export type RawParams = Record<string, string | string[] | undefined>;

export const LIST_PAGE_SIZE = 20;
const MAX_TEXT_LENGTH = 80;

/** The first value of a query parameter that may be repeated. */
export function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A trimmed, length-limited search text, or undefined when empty. */
export function textParam(value: string | string[] | undefined): string | undefined {
  const text = firstOf(value)?.trim().slice(0, MAX_TEXT_LENGTH);
  return text ? text : undefined;
}

/** A page number from the URL; anything unreadable is page 1. */
export function pageParam(value: string | string[] | undefined): number {
  const page = Number(firstOf(value));
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/** A value of an enum from the URL, or undefined when it is not one of the given values. */
export function choiceParam<Choice extends string>(
  value: string | string[] | undefined,
  choices: readonly Choice[],
): Choice | undefined {
  const text = firstOf(value);
  return choices.find((choice) => choice === text);
}

/** The path with the given parameters; empty ones leave no trace in the URL (13-UX section 3). */
export function hrefWith(
  basePath: string,
  params: Record<string, string | number | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(name, String(value));
  }
  const text = search.toString();
  return text === "" ? basePath : `${basePath}?${text}`;
}
