/**
 * The return window (plan 3.5b decision 2). A return is allowed while today's organization-local
 * date is no later than the completion date plus the window. `YYYY-MM-DD` strings compare in date order.
 */
export function isReturnWindowOpen(input: {
  readonly completedBusinessDate: string;
  readonly todayBusinessDate: string;
  readonly windowDays: number;
}): boolean {
  return addDays(input.completedBusinessDate, input.windowDays) >= input.todayBusinessDate;
}

function addDays(businessDate: string, days: number): string {
  const [year, month, day] = businessDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days));
  return shifted.toISOString().slice(0, 10);
}
