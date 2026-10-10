export async function addOne(): Promise<number> {
  const value = await Promise.resolve(1);
  return value + 1;
}
