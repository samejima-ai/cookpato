/**
 * 日本の祝日判定ユーティリティ。
 * @holiday-jp/holiday_jp の静的データを利用するため外部通信は発生しない。
 * date-fns のみを扱う src/lib/date.ts とは責務を分離してある。
 *
 * holiday_jp.holidays は YYYY-MM-DD 形式をキーとする祝日マップで、
 * DateKey と同形式のためそのまま直引きできる（O(1)、配列生成なし）。
 * ライブラリ同梱の isHoliday / between は内部で Object.keys の走査や
 * 配列生成を行うため、カレンダーの全表示行ぶん呼び出すと負荷が増える。
 */
import holiday_jp from "@holiday-jp/holiday_jp";
import type { DateKey } from "../types";

// 型は巨大な literal union のため、ここで一度 Record に narrow して扱う。
const holidays = holiday_jp.holidays as Record<string, { name: string } | undefined>;

/** 日本の祝日か */
export function isHoliday(key: DateKey): boolean {
  return holidays[key] !== undefined;
}

/** 祝日名（祝日でなければ null） */
export function getHolidayName(key: DateKey): string | null {
  return holidays[key]?.name ?? null;
}
