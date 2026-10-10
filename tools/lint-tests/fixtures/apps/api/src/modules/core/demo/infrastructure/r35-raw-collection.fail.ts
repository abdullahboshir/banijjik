export function countRaw(model: {
  collection: { countDocuments(): Promise<number> };
}): Promise<number> {
  return model.collection.countDocuments();
}
