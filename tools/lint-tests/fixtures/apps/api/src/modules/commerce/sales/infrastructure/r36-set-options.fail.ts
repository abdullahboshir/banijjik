interface SettableQuery {
  setOptions(options: object): Promise<unknown[]>;
}

export function readEveryOrganization(query: SettableQuery): Promise<unknown[]> {
  return query.setOptions({ middleware: false });
}
