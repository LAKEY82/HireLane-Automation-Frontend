// Display helpers shared by the pages.
const TZ = "Asia/Colombo";

export function timeAgo(input: string | null | undefined): string {
  if (!input) return "—";
  const date = new Date(input.includes("T") ? input : input.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return input;
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const units: [number, string][] = [[60, "minute"], [3600, "hour"], [86400, "day"], [604800, "week"]];
  for (let i = units.length - 1; i >= 0; i--) {
    const [size, name] = units[i];
    if (seconds >= size) {
      const n = Math.floor(seconds / size);
      if (name === "week" && n > 4) break;
      return `${n} ${name}${n === 1 ? "" : "s"} ago`;
    }
  }
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
}

export const fullDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: TZ }) : "—";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export const splitList = (value: string) => value.split(/[,;\n•]+/).map((s) => s.trim()).filter(Boolean);
