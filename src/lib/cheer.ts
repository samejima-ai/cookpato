/**
 * 空日に表示する応援イラストの対象日集合を算出する純粋関数。
 * 仕様は SPEC.md「空状態の応援表示」参照。
 */
import type { DateKey, DayMeals } from "../types";
import { addDaysKey } from "./date";

const WINDOW_DAYS = 7;

/** 起動時自動生成のデフォルト行数 */
export const CHEER_AUTO_LINE_COUNT = 4;

/**
 * その日が空（中身がない）か。
 *
 * 「中身がない」の定義は以下のいずれか：
 * - DayMeals 自体が undefined
 * - lines が 0 個
 * - lines がすべて空文字（自動生成された 4 空行を含む）
 *
 * 起動時自動生成（useAppData の useEffect）で 4 空行が投入された日も
 * 「空日」とみなされ、シマエナガ表示が継続する。妻が 1 行でも書き込めば
 * 空日でなくなり、シマエナガは消える。
 */
export function isEmptyDay(day: DayMeals | undefined): boolean {
  if (!day) return true;
  const { lines } = day;
  if (lines.length === 0) return true;
  return lines.every((l) => l.text === "");
}

/**
 * 今日を含む 7 日間（today〜today+6）のうち空日の集合を返す。
 * 過去日は起点を today にしているため自然に対象外。
 */
export function computeCheerDates(meals: Record<DateKey, DayMeals>, today: DateKey): Set<DateKey> {
  const result = new Set<DateKey>();
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const d = addDaysKey(today, i);
    if (isEmptyDay(meals[d])) result.add(d);
  }
  return result;
}
