/**
 * 週単位の判定ロジック。週は日曜始まり（日〜土の7日）。
 */
import type { DateKey, DayMeals } from "../types";
import { addDaysKey, startOfWeekKey } from "./date";

/** 献立の入った日か（空・欠落は false） */
function isFilled(day: DayMeals | undefined): boolean {
  if (!day) return false;
  const { lines } = day;
  if (lines.length === 0) return false;
  if (lines.length === 1 && lines[0]?.text === "") return false;
  return true;
}

/**
 * date を含む週（日曜始まり）の 7 日がすべて埋まっているか。
 */
export function isWeekComplete(meals: Record<DateKey, DayMeals>, date: DateKey): boolean {
  const sunday = startOfWeekKey(date);
  for (let i = 0; i < 7; i++) {
    const d = addDaysKey(sunday, i);
    if (!isFilled(meals[d])) return false;
  }
  return true;
}

/**
 * 指定範囲（ラフに today±span）内で「埋まっている週の日曜」集合を返す。
 * DayRow で日曜行にマークを出すため、日曜キーだけ持っていれば足りる。
 */
export function computeCompleteWeekSundays(
  meals: Record<DateKey, DayMeals>,
  rangeStart: DateKey,
  rangeEnd: DateKey,
): Set<DateKey> {
  const result = new Set<DateKey>();
  // rangeStart を含む週の日曜から、週単位で rangeEnd を超えるまで走査
  let sunday = startOfWeekKey(rangeStart);
  while (sunday <= rangeEnd) {
    if (isWeekComplete(meals, sunday)) result.add(sunday);
    sunday = addDaysKey(sunday, 7);
  }
  return result;
}
