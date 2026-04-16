/**
 * 日本の祝日判定ユーティリティ。
 * @holiday-jp/holiday_jp の静的データを利用するため外部通信は発生しない。
 * date-fns のみを扱う src/lib/date.ts とは責務を分離してある。
 */
import holiday_jp from "@holiday-jp/holiday_jp";
import type { DateKey } from "../types";
import { fromDateKey } from "./date";

/** 日本の祝日か */
export function isHoliday(key: DateKey): boolean {
  return holiday_jp.isHoliday(key);
}

/** 祝日名（祝日でなければ null） */
export function getHolidayName(key: DateKey): string | null {
  const d = fromDateKey(key);
  const found = holiday_jp.between(d, d);
  const first = found[0];
  return first ? first.name : null;
}
