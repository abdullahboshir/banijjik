interface KernelContext {
  runAsSystem(reason: string, work: () => Promise<number>): Promise<number>;
}

export async function readEverything(context: KernelContext): Promise<number> {
  return context.runAsSystem("AUTH_LOOKUP", async () => 1);
}
