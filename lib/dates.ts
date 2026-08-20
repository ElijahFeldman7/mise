/** Weeks start on Monday. Dates on the wire are always "YYYY-MM-DD", local. */

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const FULL_DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const;

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function startOfWeek(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (copy.getDay() + 6) % 7; // Monday = 0
  copy.setDate(copy.getDate() - offset);
  return copy;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

/** "Aug 17 – 23", or "Aug 30 – Sep 5" when it straddles a month. */
export function formatWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const startMonth = weekStart.toLocaleString("en-US", { month: "short" });
  const endMonth = end.toLocaleString("en-US", { month: "short" });
  return startMonth === endMonth
    ? `${startMonth} ${weekStart.getDate()} – ${end.getDate()}`
    : `${startMonth} ${weekStart.getDate()} – ${endMonth} ${end.getDate()}`;
}

export function formatLongDate(date: Date): string {
  return date.toLocaleString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

/** "18:30:00" -> "6:30". Empty for a slot with no time. */
export function formatTime(time: string | null): string {
  if (!time) return "";
  const [hourText, minuteText] = time.split(":");
  let hour = Number(hourText);
  const suffix = hour >= 12 ? "pm" : "am";
  hour = hour % 12 || 12;
  return minuteText === "00" ? `${hour}${suffix}` : `${hour}:${minuteText}${suffix}`;
}

export function formatMinutes(minutes: number | null): string {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}
