/** A toast for a finished write. The toast library loads on demand (13-UX section 11). */
export async function announceSuccess(message: string): Promise<void> {
  const { toast } = await import("@banijjik/ui/toast");
  toast.success(message);
}
