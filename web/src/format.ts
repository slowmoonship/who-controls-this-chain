export function pct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}

export function num(n: number): string {
  return n.toLocaleString("en-US");
}

export function shortAddr(a?: string | null): string {
  if (!a) return "—";
  return a.length > 14 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a;
}

export function utcTime(iso: string): string {
  // "2026-11-12T00:32:24Z" -> "2026-11-12 00:32 UTC"
  return iso.replace("T", " ").replace(/Z$/, "") + " UTC";
}

export function ageText(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((now.getTime() - then) / 60000));
  if (mins < 60) return `${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} h`;
  return `${Math.round(hrs / 24)} d`;
}
