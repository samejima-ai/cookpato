import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSearch } from "../src/hooks/useSearch";
import type { AppData } from "../src/types";

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
  };
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
});
