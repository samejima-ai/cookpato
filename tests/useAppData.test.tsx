import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAppData } from "../src/hooks/useAppData";
import { normalize } from "../src/lib/normalize";

beforeEach(() => {
  localStorage.clear();
});

describe("useAppData", () => {
  it("初期状態は空", () => {
    const { result } = renderHook(() => useAppData());
    expect(Object.keys(result.current.data.meals)).toHaveLength(0);
    expect(result.current.data.stock).toHaveLength(0);
    expect(result.current.data.favorites).toHaveLength(0);
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

    act(() => {
      result.current.setMealsText("2026-04-15", "豚バラ大根\nサラダ");
    });
    expect(result.current.data.meals["2026-04-15"]?.lines[0]?.done).toBe(true);
    expect(result.current.data.meals["2026-04-15"]?.lines[1]?.done).toBe(false);
  });

  describe("ストック", () => {
    it("addStock は qty 省略時 1 で追加される", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.addStock("グラタンのもと");
      });
      expect(result.current.data.stock).toHaveLength(1);
      expect(result.current.data.stock[0]?.text).toBe("グラタンのもと");
      expect(result.current.data.stock[0]?.qty).toBe(1);
    });

    it("addStock は qty 指定で任意個数を追加できる", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.addStock("下味豚", 3);
      });
      expect(result.current.data.stock[0]?.qty).toBe(3);
    });

    it("addStock は空文字を追加しない", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.addStock("   ");
      });
      expect(result.current.data.stock).toHaveLength(0);
    });

    it("incStock / decStock で qty を増減できる", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.addStock("グラタン", 2);
      });
      const id = result.current.data.stock[0]?.id ?? "";
      act(() => {
        result.current.incStock(id);
      });
      expect(result.current.data.stock[0]?.qty).toBe(3);
      act(() => {
        result.current.decStock(id);
        result.current.decStock(id);
      });
      expect(result.current.data.stock[0]?.qty).toBe(1);
    });

    it("decStock は qty を 0 未満にしない", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.addStock("グラタン", 1);
      });
      const id = result.current.data.stock[0]?.id ?? "";
      act(() => {
        result.current.decStock(id);
        result.current.decStock(id);
        result.current.decStock(id);
      });
      expect(result.current.data.stock[0]?.qty).toBe(0);
      // 復帰：再び inc で 1 に戻せる（ユーザーが間違えて 0 にしたケース）
      act(() => {
        result.current.incStock(id);
      });
      expect(result.current.data.stock[0]?.qty).toBe(1);
    });

    it("removeStock で項目を削除できる", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.addStock("グラタン");
        result.current.addStock("下味豚");
      });
      const firstId = result.current.data.stock[0]?.id ?? "";
      act(() => {
        result.current.removeStock(firstId);
      });
      expect(result.current.data.stock).toHaveLength(1);
      expect(result.current.data.stock[0]?.text).toBe("下味豚");
    });
  });

  describe("お気に入りマーカー（正規化共有）", () => {
    it("toggleFavorite で正規化キーが favorites に追加される", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2026-04-15", "豚バラ大根\nサラダ");
      });
      act(() => {
        result.current.toggleFavorite("2026-04-15", 0);
      });
      expect(result.current.data.favorites).toContain(normalize("豚バラ大根"));
      expect(result.current.data.favorites).not.toContain(normalize("サラダ"));
    });

    it("同じ料理を再度 toggle すると favorites から外れる", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2026-04-15", "カレー");
      });
      act(() => {
        result.current.toggleFavorite("2026-04-15", 0);
      });
      expect(result.current.data.favorites).toContain(normalize("カレー"));
      act(() => {
        result.current.toggleFavorite("2026-04-15", 0);
      });
      expect(result.current.data.favorites).not.toContain(normalize("カレー"));
    });

    it("別日に同じ料理を書いてもお気に入りキーは共通（正規化一致：ひらがな/カタカナ）", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2026-04-15", "豚バラ大根");
        result.current.setMealsText("2026-05-01", "豚ばら大根");
      });
      act(() => {
        result.current.toggleFavorite("2026-04-15", 0);
      });
      // ひらがな/カタカナは normalize で同一キーになる
      const key = normalize("豚バラ大根");
      expect(normalize("豚ばら大根")).toBe(key);
      expect(result.current.data.favorites).toContain(key);
      // 別日からの解除も一発で効く（共通キー）
      act(() => {
        result.current.toggleFavorite("2026-05-01", 0);
      });
      expect(result.current.data.favorites).not.toContain(key);
    });

    it("空文字の行はお気に入り対象外", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2026-04-15", "カレー\n");
      });
      // 2 行目は空
      act(() => {
        result.current.toggleFavorite("2026-04-15", 1);
      });
      expect(result.current.data.favorites).toHaveLength(0);
    });

    it("お気に入りと完了は独立", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2026-04-15", "カレー");
      });
      act(() => {
        result.current.toggleFavorite("2026-04-15", 0);
        result.current.toggleLine("2026-04-15", 0);
      });
      expect(result.current.data.favorites).toContain(normalize("カレー"));
      expect(result.current.data.meals["2026-04-15"]?.lines[0]?.done).toBe(true);
    });

    it("legacy データ（favorites フィールドなし）は空配列として読み込まれる", () => {
      const legacy = {
        version: 1,
        meals: {
          "2026-04-10": {
            lines: [{ text: "豚バラ大根", done: true }],
          },
        },
        stock: [],
      };
      localStorage.setItem("cookpato:data:v1", JSON.stringify(legacy));
      const { result } = renderHook(() => useAppData());
      expect(result.current.data.favorites).toEqual([]);
      expect(result.current.data.meals["2026-04-10"]?.lines[0]?.text).toBe("豚バラ大根");
    });
  });
});
