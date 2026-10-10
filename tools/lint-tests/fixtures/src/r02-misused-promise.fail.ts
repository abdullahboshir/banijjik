async function saveValue(value: number): Promise<void> {
  await Promise.resolve(value);
}

export function saveAll(values: number[]): void {
  values.forEach(async (value) => {
    await saveValue(value);
  });
}
