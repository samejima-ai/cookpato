import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAppData } from "../src/hooks/useAppData";
import { favoriteKey } from "../src/lib/normalize";

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

  describe("deleteLine", () => {
    it("指定行だけ削除され、他行の完了状態は維持される", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2026-04-15", "豚バラ大根\nサラダ\nスープ");
      });
      act(() => {
        result.current.toggleLine("2026-04-15", 0); // 豚バラ大根 done
        result.current.toggleLine("2026-04-15", 2); // スープ done
      });
      act(() => {
        result.current.deleteLine("2026-04-15", 1); // サラダ削除
      });
      const lines = result.current.data.meals["2026-04-15"]?.lines ?? [];
      expect(lines.map((l) => l.text)).toEqual(["豚バラ大根", "スープ"]);
      expect(lines[0]?.done).toBe(true);
      expect(lines[1]?.done).toBe(true);
    });

    it("全行を削除すると meals からその日が消える", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2026-04-15", "カレー");
      });
      act(() => {
        result.current.deleteLine("2026-04-15", 0);
      });
      expect(result.current.data.meals["2026-04-15"]).toBeUndefined();
    });

    it("範囲外 index は no-op", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2026-04-15", "カレー");
      });
      act(() => {
        result.current.deleteLine("2026-04-15", 5);
      });
      expect(result.current.data.meals["2026-04-15"]?.lines).toHaveLength(1);
    });
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

  describe("ちょいメモ", () => {
    it("setMemo でその日のメモを保存できる", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMemo("2026-04-15", "遅くなる");
      });
      expect(result.current.data.meals["2026-04-15"]?.memo).toBe("遅くなる");
    });

    it("setMemo に空文字を渡すと memo が消え、lines も空なら日付ごと除外される", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMemo("2026-04-15", "外食");
      });
      expect(result.current.data.meals["2026-04-15"]?.memo).toBe("外食");
      act(() => {
        result.current.setMemo("2026-04-15", "");
      });
      expect(result.current.data.meals["2026-04-15"]).toBeUndefined();
    });

    it("setMemo に空文字を渡しても lines があれば日付は残り memo だけ消える", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2026-04-15", "カレー");
        result.current.setMemo("2026-04-15", "辛口");
      });
      expect(result.current.data.meals["2026-04-15"]?.memo).toBe("辛口");
      act(() => {
        result.current.setMemo("2026-04-15", "");
      });
      expect(result.current.data.meals["2026-04-15"]?.lines[0]?.text).toBe("カレー");
      expect(result.current.data.meals["2026-04-15"]?.memo).toBeUndefined();
    });

    it("setMealsText で lines を空にしても memo があれば日付は残る", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2026-04-15", "カレー");
        result.current.setMemo("2026-04-15", "遅くなる");
      });
      act(() => {
        result.current.setMealsText("2026-04-15", "");
      });
      expect(result.current.data.meals["2026-04-15"]?.memo).toBe("遅くなる");
    });

    it("deleteLine で全行が消えても memo があれば日付は残る", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2026-04-15", "カレー");
        result.current.setMemo("2026-04-15", "メモ");
      });
      act(() => {
        result.current.deleteLine("2026-04-15", 0);
      });
      expect(result.current.data.meals["2026-04-15"]?.memo).toBe("メモ");
      expect(result.current.data.meals["2026-04-15"]?.lines.length).toBe(0);
    });

    it("memo は週達成判定に影響しない（料理が空なら埋まっていない扱い）", () => {
      const { result } = renderHook(() => useAppData());
      // 2026-04-12 (SUN) 〜 2026-04-18 (SAT)
      const WEEK = [
        "2026-04-12",
        "2026-04-13",
        "2026-04-14",
        "2026-04-15",
        "2026-04-16",
        "2026-04-17",
      ];
      act(() => {
        for (const d of WEEK) result.current.setMealsText(d, "x");
      });
      // 土曜はメモだけ設定 → 料理が埋まっていないので達成しない
      act(() => {
        result.current.setMemo("2026-04-18", "外食");
      });
      expect(result.current.justCompletedSunday).toBeNull();
    });

    it("legacy データ（memo フィールドなし）は memo undefined で読み込まれる", () => {
      const legacy = {
        version: 1,
        meals: {
          "2026-04-10": { lines: [{ text: "カレー", done: false }] },
        },
        stock: [],
        favorites: [],
      };
      localStorage.setItem("cookpato:data:v1", JSON.stringify(legacy));
      const { result } = renderHook(() => useAppData());
      expect(result.current.data.meals["2026-04-10"]?.memo).toBeUndefined();
      expect(result.current.data.meals["2026-04-10"]?.lines[0]?.text).toBe("カレー");
    });
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

    describe("並び替え", () => {
      it("moveStockUp で 1 つ上の項目と入れ替わる", () => {
        const { result } = renderHook(() => useAppData());
        act(() => {
          result.current.addStock("A");
          result.current.addStock("B");
          result.current.addStock("C");
        });
        const bId = result.current.data.stock[1]?.id ?? "";
        act(() => {
          result.current.moveStockUp(bId);
        });
        expect(result.current.data.stock.map((s) => s.text)).toEqual(["B", "A", "C"]);
      });

      it("moveStockDown で 1 つ下の項目と入れ替わる", () => {
        const { result } = renderHook(() => useAppData());
        act(() => {
          result.current.addStock("A");
          result.current.addStock("B");
          result.current.addStock("C");
        });
        const bId = result.current.data.stock[1]?.id ?? "";
        act(() => {
          result.current.moveStockDown(bId);
        });
        expect(result.current.data.stock.map((s) => s.text)).toEqual(["A", "C", "B"]);
      });

      it("先頭で moveStockUp は no-op", () => {
        const { result } = renderHook(() => useAppData());
        act(() => {
          result.current.addStock("A");
          result.current.addStock("B");
        });
        const aId = result.current.data.stock[0]?.id ?? "";
        act(() => {
          result.current.moveStockUp(aId);
        });
        expect(result.current.data.stock.map((s) => s.text)).toEqual(["A", "B"]);
      });

      it("末尾で moveStockDown は no-op", () => {
        const { result } = renderHook(() => useAppData());
        act(() => {
          result.current.addStock("A");
          result.current.addStock("B");
        });
        const bId = result.current.data.stock[1]?.id ?? "";
        act(() => {
          result.current.moveStockDown(bId);
        });
        expect(result.current.data.stock.map((s) => s.text)).toEqual(["A", "B"]);
      });

      it("不明な id の場合は no-op", () => {
        const { result } = renderHook(() => useAppData());
        act(() => {
          result.current.addStock("A");
          result.current.addStock("B");
        });
        act(() => {
          result.current.moveStockUp("unknown-id");
          result.current.moveStockDown("unknown-id");
        });
        expect(result.current.data.stock.map((s) => s.text)).toEqual(["A", "B"]);
      });

      it("qty や個数ボタンの状態は移動後も保持される", () => {
        const { result } = renderHook(() => useAppData());
        act(() => {
          result.current.addStock("A", 5);
          result.current.addStock("B", 2);
        });
        const aId = result.current.data.stock[0]?.id ?? "";
        act(() => {
          result.current.moveStockDown(aId);
        });
        expect(result.current.data.stock[0]?.text).toBe("B");
        expect(result.current.data.stock[0]?.qty).toBe(2);
        expect(result.current.data.stock[1]?.text).toBe("A");
        expect(result.current.data.stock[1]?.qty).toBe(5);
      });
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
      expect(result.current.data.favorites).toContain(favoriteKey("豚バラ大根"));
      expect(result.current.data.favorites).not.toContain(favoriteKey("サラダ"));
    });

    it("同じ料理を再度 toggle すると favorites から外れる", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2026-04-15", "カレー");
      });
      act(() => {
        result.current.toggleFavorite("2026-04-15", 0);
      });
      expect(result.current.data.favorites).toContain(favoriteKey("カレー"));
      act(() => {
        result.current.toggleFavorite("2026-04-15", 0);
      });
      expect(result.current.data.favorites).not.toContain(favoriteKey("カレー"));
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
      const key = favoriteKey("豚バラ大根");
      expect(favoriteKey("豚ばら大根")).toBe(key);
      expect(result.current.data.favorites).toContain(key);
      // 別日からの解除も一発で効く（共通キー）
      act(() => {
        result.current.toggleFavorite("2026-05-01", 0);
      });
      expect(result.current.data.favorites).not.toContain(key);
    });

    it("空白区切りの補足付きでも先頭トークン一致で共通マーキングされる", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2026-04-15", "豚バラもやし");
        result.current.setMealsText("2026-04-16", "豚バラもやし 味噌");
        result.current.setMealsText("2026-04-17", "豚ばらもやし");
      });
      act(() => {
        result.current.toggleFavorite("2026-04-15", 0);
      });
      const key = favoriteKey("豚バラもやし");
      expect(result.current.data.favorites).toEqual([key]);
      // 3 行とも同じキーに解決されることを確認
      expect(favoriteKey("豚バラもやし 味噌")).toBe(key);
      expect(favoriteKey("豚ばらもやし")).toBe(key);
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
      expect(result.current.data.favorites).toContain(favoriteKey("カレー"));
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

  describe("週達成の遷移トリガー", () => {
    // 2026-04-12 は日曜、2026-04-18 は土曜
    const SUN = "2026-04-12";
    const WEEK = [SUN, "2026-04-13", "2026-04-14", "2026-04-15", "2026-04-16", "2026-04-17"];
    const SAT = "2026-04-18";

    it("初期は justCompletedSunday が null", () => {
      const { result } = renderHook(() => useAppData());
      expect(result.current.justCompletedSunday).toBeNull();
    });

    it("最後の1日を埋めて満タンになった瞬間にその週の日曜がセットされる", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        for (const d of WEEK) result.current.setMealsText(d, "x");
      });
      expect(result.current.justCompletedSunday).toBeNull();
      act(() => {
        result.current.setMealsText(SAT, "x");
      });
      expect(result.current.justCompletedSunday).toBe(SUN);
    });

    it("既に満タンの週を再編集しても再トリガーしない", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        for (const d of [...WEEK, SAT]) result.current.setMealsText(d, "x");
      });
      expect(result.current.justCompletedSunday).toBe(SUN);
      act(() => {
        result.current.clearJustCompleted();
      });
      expect(result.current.justCompletedSunday).toBeNull();
      // 既に満タンの週を再編集
      act(() => {
        result.current.setMealsText(SAT, "y");
      });
      expect(result.current.justCompletedSunday).toBeNull();
    });

    it("clearJustCompleted で null に戻せる", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        for (const d of [...WEEK, SAT]) result.current.setMealsText(d, "x");
      });
      expect(result.current.justCompletedSunday).toBe(SUN);
      act(() => {
        result.current.clearJustCompleted();
      });
      expect(result.current.justCompletedSunday).toBeNull();
    });
  });
});
