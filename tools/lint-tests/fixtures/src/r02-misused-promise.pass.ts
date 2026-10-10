async function saveValue(value: number): Promise<void> {
  await Promise.resolve(value);
}

export async function saveAll(values: number[]): Promise<void> {
  for (const value of values) {
    await saveValue(value);
  }
}
