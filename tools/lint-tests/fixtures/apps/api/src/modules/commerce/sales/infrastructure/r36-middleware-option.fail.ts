interface FindableModel {
  find(filter: object, projection: null, options: object): Promise<unknown[]>;
}

export function readEveryOrganization(model: FindableModel): Promise<unknown[]> {
  return model.find({}, null, { middleware: false });
}
