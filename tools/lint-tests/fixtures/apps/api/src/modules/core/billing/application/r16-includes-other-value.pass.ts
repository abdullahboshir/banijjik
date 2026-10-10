export function isOpen(status: string): boolean {
  return ["OPEN", "PENDING"].includes(status);
}
