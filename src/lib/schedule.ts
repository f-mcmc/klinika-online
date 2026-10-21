/** Vaqt yordamchilari. Toshkent vaqti (UTC+5, yozgi vaqt yo'q). */
export const SCHEDULE = {
  /** Necha kun oldinga yozilish mumkin */
  daysAhead: 14,
  /** Qabulgacha kamida necha daqiqa qolganda yozish mumkin */
  minLeadMinutes: 30,
  /** Bemor qabulni necha soat oldin o'zi bekor qila oladi */
  cancelBeforeHours: 2,
  tzOffset: "+05:00",
  tzOffsetMinutes: 5 * 60,
} as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(date: string): boolean {
  return DATE_RE.test(date) && !Number.isNaN(new Date(`${date}T00:00:00${SCHEDULE.tzOffset}`).getTime());
}

/** Toshkent bo'yicha bugungi sana, YYYY-MM-DD. */
export function todayLocal(now: Date = new Date()): string {
  const local = new Date(now.getTime() + SCHEDULE.tzOffsetMinutes * 60_000);
  return local.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Hafta kuni: 0 = yakshanba … 6 = shanba */
export function weekday(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function localDateTime(date: string, minutesFromMidnight: number): Date {
  const h = String(Math.floor(minutesFromMidnight / 60)).padStart(2, "0");
  const m = String(minutesFromMidnight % 60).padStart(2, "0");
  return new Date(`${date}T${h}:${m}:00${SCHEDULE.tzOffset}`);
}

export function minutesToTime(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export function formatTime(d: Date): string {
  const local = new Date(d.getTime() + SCHEDULE.tzOffsetMinutes * 60_000);
  return local.toISOString().slice(11, 16);
}

export function formatDateLocal(d: Date): string {
  const local = new Date(d.getTime() + SCHEDULE.tzOffsetMinutes * 60_000);
  return local.toISOString().slice(0, 10);
}

export const WEEKDAY_SHORT = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"] as const;
const WEEKDAY_LONG = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"] as const;
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"] as const;

export function humanDate(date: string): { weekday: string; day: string; long: string } {
  const d = new Date(`${date}T12:00:00Z`);
  const day = `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()] ?? ""}`;
  return {
    weekday: WEEKDAY_SHORT[d.getUTCDay()] ?? "",
    day,
    long: `${day}, ${WEEKDAY_LONG[d.getUTCDay()] ?? ""}`,
  };
}

export function formatSum(n: number): string {
  return `${n.toLocaleString("ru-RU").replace(/\s/g, " ")} so'm`;
}

/** "1,2,3" → [1,2,3]; noto'g'ri qiymatlar tashlab yuboriladi */
export function parseWorkDays(value: string): number[] {
  return value
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isInteger(x) && x >= 0 && x <= 6);
}

/** Toshkent bo'yicha hozirgi vaqt, yarim tundan beri daqiqada */
export function nowLocalMinutes(now: Date = new Date()): number {
  const local = new Date(now.getTime() + SCHEDULE.tzOffsetMinutes * 60_000);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}
