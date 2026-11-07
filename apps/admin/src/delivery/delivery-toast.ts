export async function showSuccessToast(message: string): Promise<void> {
  const { toast } = await import("@banijjik/ui/toast");
  toast.success(message);
}
