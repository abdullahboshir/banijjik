/**
 * The toast library (sonner) loads on demand so it stays out of the first load of the order
 * routes (budget: 180 KiB), the same way the shell loads it.
 */
export async function showSuccessToast(message: string): Promise<void> {
  const { toast } = await import("@banijjik/ui/toast");
  toast.success(message);
}
