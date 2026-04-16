import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAppData } from "../src/hooks/useAppData";

beforeEach(() => {
  localStorage.clear();
});

describe("useAppData", () => {
  it("初期状態は空", () => {
    const { result } = renderHook(() => useAppData());
    expect(Object.keys(result.current.data.meals)).toHaveLength(0);
    expect(result.current.data.stock).toHaveLength(0);
  });

  it("setMealsText で1日分のテキストを保存", () => {
    const { result } = renderHook(() => useAppData());
    act(() => {
      result.current.setMealsText("2026-04-15", "豚バラ大根\nサラダ");
    });
    const day = result.current.data.meals["2026-04-15"];
    expect(day?.lines).toHaveLength(2);
    expect(day?.lines[0]?.text).toBe("豚バラ大根");
    expect(day?.lines[1]?.text).toBe("サラダ");
  });

  it("toggleLine で行単位の完了状態を切り替える", () => {
    const { result } = renderHook(() => useAppData());
    act(() => {
      result.current.setMealsText("2026-04-15", "豚バラ大根\nサラダ");
    });
    act(() => {
      result.current.toggleLine("2026-04-15", 0);
    });
    expect(result.current.data.meals["2026-04-15"]?.lines[0]?.done).toBe(true);
    expect(result.current.data.meals["2026-04-15"]?.lines[1]?.done).toBe(false);
  });

  it("編集で行数が変わると完了状態がリセットされる（内容が同じ行は維持）", () => {
    const { result } = renderHook(() => useAppData());
    act(() => {
      result.current.setMealsText("2026-04-15", "豚バラ大根");
    });
    act(() => {
      result.current.toggleLine("2026-04-15", 0);
    });
    expect(result.current.data.meals["2026-04-15"]?.lines[0]?.done).toBe(true);

    // 同じ1行目に新しい行を追加
    act(() => {
      result.current.setMealsText("2026-04-15", "豚バラ大根\nサラダ");
    });
    // 1行目は内容同じなので done 維持、2行目は新規で false
    expect(result.current.data.meals["2026-04-15"]?.lines[0]?.done).toBe(true);
    expect(result.current.data.meals["2026-04-15"]?.lines[1]?.done).toBe(false);
  });

  it("addStock / removeStock", () => {
    const { result } = renderHook(() => useAppData());
    act(() => {
      result.current.addStock("グラタンのもと 1個");
    });
    act(() => {
      result.current.addStock("ミネストローネ 2個");
    });
    expect(result.current.data.stock).toHaveLength(2);

    const firstId = result.current.data.stock[0]?.id ?? "";
    act(() => {
      result.current.removeStock(firstId);
    });
    expect(result.current.data.stock).toHaveLength(1);
    expect(result.current.data.stock[0]?.text).toBe("ミネストローネ 2個");
  });

  it("空文字のstockは追加されない", () => {
    const { result } = renderHook(() => useAppData());
    act(() => {
      result.current.addStock("   ");
    });
    expect(result.current.data.stock).toHaveLength(0);
  });
});
