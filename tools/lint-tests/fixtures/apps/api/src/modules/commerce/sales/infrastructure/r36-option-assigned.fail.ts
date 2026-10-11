interface OptionedQuery {
  options: { middleware?: boolean };
}

export function switchHooksOff(query: OptionedQuery): void {
  query.options.middleware = false;
}
