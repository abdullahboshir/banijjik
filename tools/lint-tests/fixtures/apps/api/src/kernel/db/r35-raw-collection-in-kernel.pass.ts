export function countRawInKernel(model: {
  collection: { countDocuments(): Promise<number> };
}): Promise<number> {
  return model.collection.countDocuments();
}
