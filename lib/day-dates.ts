// UK-local dates for the Close-the-day loop.
// A brain-dump before 4am still counts as "last night", so it's for today.
export function ukDate(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}
export function ukHour(d: Date): number {
  return Number(d.toLocaleString("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }));
}
export function reportTargetDate(now = new Date()): string {
  return ukHour(now) < 4 ? ukDate(now) : ukDate(new Date(now.getTime() + 24 * 60 * 60 * 1000));
}
