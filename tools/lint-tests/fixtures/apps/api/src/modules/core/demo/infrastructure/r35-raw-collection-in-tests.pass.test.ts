export function countRawInTest(model: {
  collection: { countDocuments(): Promise<number> };
}): Promise<number> {
  return model.collection.countDocuments();
}
