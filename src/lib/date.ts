/**
 * 日付操作のユーティリティ。date-fns を使用する。
 * DateKey は YYYY-MM-DD 形式の文字列（ローカル基準）。
 */
import { addDays, format, getDay, parseISO, startOfDay, startOfWeek } from "date-fns";
import type { DateKey } from "../types";

const DATE_FORMAT = "yyyy-MM-dd";

/** Date オブジェクトを DateKey に変換 */
export function toDateKey(date: Date): DateKey {
  return format(startOfDay(date), DATE_FORMAT);
}

/** DateKey を Date オブジェクトに変換（ローカル 00:00:00） */
export function fromDateKey(key: DateKey): Date {
  return parseISO(key);
}

/** 当日の DateKey */
export function todayKey(): DateKey {
  return toDateKey(new Date());
}

/** 指定日から n 日後の DateKey */
export function addDaysKey(key: DateKey, days: number): DateKey {
  return toDateKey(addDays(fromDateKey(key), days));
}

/** 表示用：M月D日（曜） */
export function formatDayLabel(key: DateKey): string {
  const d = fromDateKey(key);
  const dow = ["日", "月", "火", "水", "木", "金", "土"][getDay(d)];
  return `${d.getMonth() + 1}月${d.getDate()}日（${dow}）`;
}

/** 表示用：YYYY年M月（月ヘッダー） */
export function formatMonthHeader(key: DateKey): string {
  const d = fromDateKey(key);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

/** 日曜か */
export function isSunday(key: DateKey): boolean {
  return getDay(fromDateKey(key)) === 0;
}

/** 土曜か */
export function isSaturday(key: DateKey): boolean {
  return getDay(fromDateKey(key)) === 6;
}

/** その月の初日か（=月ヘッダーを描画する位置） */
export function isFirstOfMonth(key: DateKey): boolean {
  return fromDateKey(key).getDate() === 1;
}

/** 指定日を含む週（日曜始まり）の日曜の DateKey */
export function startOfWeekKey(key: DateKey): DateKey {
  return toDateKey(startOfWeek(fromDateKey(key), { weekStartsOn: 0 }));
}

/** 2日間が同月か */
export function isSameMonth(a: DateKey, b: DateKey): boolean {
  const da = fromDateKey(a);
  const db = fromDateKey(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth();
}
