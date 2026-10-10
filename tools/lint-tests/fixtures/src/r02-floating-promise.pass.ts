async function loadValue(): Promise<number> {
  return 1;
}

export async function run(): Promise<number> {
  return await loadValue();
}

export function runInBackground(): void {
  void loadValue();
}
