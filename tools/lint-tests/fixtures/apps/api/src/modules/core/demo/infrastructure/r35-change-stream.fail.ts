export function streamEverything(model: {
  watch(): AsyncIterable<unknown>;
}): AsyncIterable<unknown> {
  return model.watch();
}
