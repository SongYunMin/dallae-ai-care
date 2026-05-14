const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

type KstParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

export function kstParts(date: Date = new Date()): KstParts {
  // Date는 UTC instant를 담으므로 9시간을 더한 뒤 UTC getter로 KST 벽시계를 읽는다.
  const shifted = new Date(date.getTime() + KST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

export function nowKstIso(date: Date = new Date()): string {
  const p = kstParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}+09:00`;
}

export function kstDateKey(date: Date = new Date()): string {
  const p = kstParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function dateFromKstWallTime(date: string, time = "00:00"): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute, 0, 0));
}

export function kstWeekday(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}
