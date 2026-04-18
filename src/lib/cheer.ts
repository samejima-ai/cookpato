/**
 * 空日に表示する応援イラストの対象日集合を算出する純粋関数。
 * 仕様は SPEC.md「空状態の応援表示」参照。
 */
import type { DateKey, DayMeals } from "../types";
import { addDaysKey } from "./date";

const WINDOW_DAYS = 7;

function isEmpty(day: DayMeals | undefined): boolean {
  if (!day) return true;
  const { lines } = day;
  if (lines.length === 0) return true;
  if (lines.length === 1 && lines[0]?.text === "") return true;
  return false;
}

/**
 * 今日を含む 7 日間（today〜today+6）のうち空日の集合を返す。
 * 過去日は起点を today にしているため自然に対象外。
 */
export function computeCheerDates(meals: Record<DateKey, DayMeals>, today: DateKey): Set<DateKey> {
  const result = new Set<DateKey>();
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const d = addDaysKey(today, i);
    if (isEmpty(meals[d])) result.add(d);
  }
  return result;
}
