import { formatDistanceToNow, format } from "date-fns";

/** "3 minutes ago", "in 2 minutes" */
export function relTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

/** "15 Oct 2026 at 14:32" */
export function fullTime(iso: string): string {
  try {
    return format(new Date(iso), "d MMM yyyy 'at' HH:mm");
  } catch {
    return "";
  }
}

/** "14:32" */
export function clockTime(iso: string): string {
  try {
    return format(new Date(iso), "HH:mm");
  } catch {
    return "";
  }
}

/** mm ss countdown for the in-transit indicator */
export function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m > 0) return `${m}m ${String(r).padStart(2, "0")}s`;
  return `${r}s`;
}
