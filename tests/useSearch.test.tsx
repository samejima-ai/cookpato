import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSearch } from "../src/hooks/useSearch";
import { addDaysKey, todayKey } from "../src/lib/date";
import type { AppData, DayMeals } from "../src/types";

function makeData(): AppData {
  return {
    version: 1,
    meals: {
      "2026-04-10": {
        lines: [
          { text: "豚バラ大根", done: false },
          { text: "サラダ", done: false },
        ],
      },
      "2026-04-12": {
        lines: [{ text: "親子丼", done: false }],
      },
      "2026-04-14": {
        lines: [{ text: "ブタバラ味噌", done: false }],
      },
    },
    stock: [],
    favorites: [],
    completedWeeks: [],
  };
}

/** 今日から daysAgo 日前の meals を組み立てる（sinceDays のテスト用、時間依存回避） */
function makeRelativeData(entries: { daysAgo: number; lines: DayMeals["lines"] }[]): AppData {
  const today = todayKey();
  const meals: Record<string, DayMeals> = {};
  for (const { daysAgo, lines } of entries) {
    meals[addDaysKey(today, -daysAgo)] = { lines };
  }
  return { version: 1, meals, stock: [], favorites: [], completedWeeks: [] };
}

describe("useSearch", () => {
  it("空クエリは結果0件", () => {
    const { result } = renderHook(() => useSearch(makeData(), ""));
    expect(result.current).toHaveLength(0);
  });

  it("「豚バラ」で 完全一致1件＋類似1件、完全一致が先", () => {
    const { result } = renderHook(() => useSearch(makeData(), "豚バラ"));
    const dates = result.current.map((h) => h.date);
    const kinds = result.current.map((h) => h.matchKind);
    // 完全一致: 2026-04-10（豚バラ大根）、類似: 2026-04-14（ブタバラ味噌のカナ部分が共通）
    expect(dates).toEqual(["2026-04-10", "2026-04-14"]);
    expect(kinds).toEqual(["exact", "similar"]);
  });

  it("ひらがな「ぶたばら」で カタカナ表記（ブタバラ味噌）に完全一致", () => {
    const { result } = renderHook(() => useSearch(makeData(), "ぶたばら"));
    const exactDates = result.current.filter((h) => h.matchKind === "exact").map((h) => h.date);
    expect(exactDates).toContain("2026-04-14");
  });

  it("ひらがな「ぶたばら」で 豚バラ大根（漢字+カナ）も類似ヒットする", () => {
    const { result } = renderHook(() => useSearch(makeData(), "ぶたばら"));
    const dates = result.current.map((h) => h.date);
    // バラ が共通カタカナとして検出される
    expect(dates).toContain("2026-04-10");
  });

  it("無関係な語はヒットしない", () => {
    const { result } = renderHook(() => useSearch(makeData(), "カレーライス"));
    expect(result.current.filter((h) => h.matchKind === "exact")).toHaveLength(0);
  });

  describe("options", () => {
    it("sinceDays: N日より古い日付は除外される", () => {
      const data = makeRelativeData([
        { daysAgo: 10, lines: [{ text: "豚バラ大根", done: false }] },
        { daysAgo: 400, lines: [{ text: "豚バラ味噌", done: false }] },
      ]);
      const { result } = renderHook(() => useSearch(data, "豚バラ", { sinceDays: 365 }));
      const dates = result.current.map((h) => h.date);
      expect(dates).toHaveLength(1);
      expect(dates[0]).toBe(addDaysKey(todayKey(), -10));
    });

    it("maxResults: 完全一致の返却件数を上限で打ち切る", () => {
      const entries = Array.from({ length: 5 }, (_, i) => ({
        daysAgo: i + 1,
        lines: [{ text: "豚バラ", done: false }],
      }));
      const data = makeRelativeData(entries);
      const { result } = renderHook(() => useSearch(data, "豚バラ", { maxResults: 3 }));
      expect(result.current).toHaveLength(3);
      expect(result.current.every((h) => h.matchKind === "exact")).toBe(true);
    });

    it("maxResults: 古い日付の完全一致を類似優先で取りこぼさない", () => {
      // 新しい日付に類似のみ、古い日付に完全一致がある構成。
      // 合計件数で打ち切ると古い exact を拾えなくなるため、exact 優先の保証を確認する。
      const data = makeRelativeData([
        { daysAgo: 1, lines: [{ text: "ブタバラ味噌", done: false }] }, // 類似
        { daysAgo: 2, lines: [{ text: "ブタバラ生姜", done: false }] }, // 類似
        { daysAgo: 3, lines: [{ text: "豚バラ大根", done: false }] }, // 完全
      ]);
      const { result } = renderHook(() => useSearch(data, "豚バラ", { maxResults: 2 }));
      const exacts = result.current.filter((h) => h.matchKind === "exact");
      // 完全一致が最後の日付に1件あるので取りこぼさない
      expect(exacts.map((h) => h.date)).toEqual([addDaysKey(todayKey(), -3)]);
    });

    it("excludeDate: 指定日付は走査対象から外す", () => {
      const data = makeRelativeData([
        { daysAgo: 1, lines: [{ text: "豚バラ大根", done: false }] },
        { daysAgo: 2, lines: [{ text: "豚バラ味噌", done: false }] },
      ]);
      const excludeDate = addDaysKey(todayKey(), -1);
      const { result } = renderHook(() => useSearch(data, "豚バラ", { excludeDate }));
      const dates = result.current.map((h) => h.date);
      expect(dates).toEqual([addDaysKey(todayKey(), -2)]);
    });
  });
});
