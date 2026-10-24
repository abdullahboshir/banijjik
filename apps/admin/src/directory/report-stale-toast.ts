/** Tells the staff member the reports changed meanwhile (M.7 decision 12). */
export async function showStaleReportsToast(message: string): Promise<void> {
  // The toast library loads on demand, like the Toaster itself (13-UX section 11).
  const { toast } = await import("@banijjik/ui/toast");
  toast.error(message);
}
