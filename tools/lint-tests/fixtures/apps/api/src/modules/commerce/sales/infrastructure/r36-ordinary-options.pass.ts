interface FindableModel {
  find(filter: object, projection: null, options: object): Promise<unknown[]>;
}

export function readOrdinary(model: FindableModel): Promise<unknown[]> {
  return model.find({}, null, { lean: true, limit: 10 });
}
