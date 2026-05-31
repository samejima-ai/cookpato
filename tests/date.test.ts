import { describe, expect, it } from "vitest";
import {
  addDaysKey,
  formatDayLabel,
  formatMonthHeader,
  isFirstOfMonth,
  isInputableDate,
  isSameMonth,
  isSunday,
  toDateKey,
} from "../src/lib/date";

describe("date lib", () => {
  it("toDateKey は YYYY-MM-DD を返す", () => {
    const d = new Date(2026, 3, 15); // 4月は 3 (0-indexed)
    expect(toDateKey(d)).toBe("2026-04-15");
  });

  it("addDaysKey は日を進める", () => {
    expect(addDaysKey("2026-04-15", 1)).toBe("2026-04-16");
    expect(addDaysKey("2026-04-15", -1)).toBe("2026-04-14");
    expect(addDaysKey("2026-04-30", 1)).toBe("2026-05-01");
  });

  it("formatDayLabel は M月D日（曜）形式", () => {
    // 2026-04-15 は水曜
    expect(formatDayLabel("2026-04-15")).toBe("4月15日（水）");
  });

  it("formatMonthHeader は YYYY年M月", () => {
    expect(formatMonthHeader("2026-04-15")).toBe("2026年4月");
  });

  it("isFirstOfMonth", () => {
    expect(isFirstOfMonth("2026-04-01")).toBe(true);
    expect(isFirstOfMonth("2026-04-15")).toBe(false);
  });

  it("isSameMonth", () => {
    expect(isSameMonth("2026-04-01", "2026-04-30")).toBe(true);
    expect(isSameMonth("2026-04-30", "2026-05-01")).toBe(false);
  });

  it("isSunday", () => {
    // 2026-04-19 は日曜
    expect(isSunday("2026-04-19")).toBe(true);
    expect(isSunday("2026-04-20")).toBe(false);
  });

  it("isInputableDate は today 以降を true、過去日を false とする", () => {
    const today = "2026-05-31";
    expect(isInputableDate("2026-05-31", today)).toBe(true); // today 自身
    expect(isInputableDate("2026-06-06", today)).toBe(true); // today+6（応援ウィンドウ最終日）
    expect(isInputableDate("2026-06-07", today)).toBe(true); // today+7（旧仕様で書けなかった日）
    expect(isInputableDate("2026-12-01", today)).toBe(true); // 遠い未来
    expect(isInputableDate("2026-05-30", today)).toBe(false); // 昨日
    expect(isInputableDate("2025-01-01", today)).toBe(false); // 過去
  });
});
