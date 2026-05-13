import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAppData } from "../src/hooks/useAppData";
import { CHEER_AUTO_LINE_COUNT } from "../src/lib/cheer";
import { favoriteKey } from "../src/lib/normalize";

beforeEach(() => {
  localStorage.clear();
});

describe("useAppData", () => {
  it("初期状態：自動生成で today〜today+6 に空行が入り、stock/favorites は空", () => {
    const { result } = renderHook(() => useAppData());
    // 起動時 useEffect でシマエナガが発生する 7 日に空行が自動投入される
    const days = Object.values(result.current.data.meals);
    expect(days.length).toBe(7);
    for (const day of days) {
      expect(day.lines.length).toBe(CHEER_AUTO_LINE_COUNT);
      expect(day.lines.every((l) => l.text === "")).toBe(true);
    }
    expect(result.current.data.stock).toHaveLength(0);
    expect(result.current.data.favorites).toHaveLength(0);
  });

  describe("bulkAddEmptyLines（一括空行投入）", () => {
    it("空日に空 Line × N を投入できる（遠未来日は自動生成対象外なのでテスト容易）", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.bulkAddEmptyLines(["2030-01-01", "2030-01-02"], 4);
      });
      expect(result.current.data.meals["2030-01-01"]?.lines.length).toBe(4);
      expect(result.current.data.meals["2030-01-02"]?.lines.length).toBe(4);
      expect(result.current.data.meals["2030-01-01"]?.lines.every((l) => l.text === "")).toBe(true);
    });

    it("既存入力がある日はスキップされる", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2030-01-01", "カレー");
      });
      act(() => {
        result.current.bulkAddEmptyLines(["2030-01-01"], 4);
      });
      expect(result.current.data.meals["2030-01-01"]?.lines.length).toBe(1);
      expect(result.current.data.meals["2030-01-01"]?.lines[0]?.text).toBe("カレー");
    });

    it("冪等：既に N 個の空行を持つ日に再投入しても state 識別子が変わらない", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.bulkAddEmptyLines(["2030-01-01"], 4);
      });
      const before = result.current.data.meals["2030-01-01"];
      act(() => {
        result.current.bulkAddEmptyLines(["2030-01-01"], 4);
      });
      expect(result.current.data.meals["2030-01-01"]).toBe(before);
    });

    it("memo を持つ空日に投入しても memo が保持される", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMemo("2030-01-01", "外食");
      });
      act(() => {
        result.current.bulkAddEmptyLines(["2030-01-01"], 4);
      });
      expect(result.current.data.meals["2030-01-01"]?.memo).toBe("外食");
      expect(result.current.data.meals["2030-01-01"]?.lines.length).toBe(4);
    });

    it("count=0 や dates=[] は no-op", () => {
      const { result } = renderHook(() => useAppData());
      const before = result.current.data.meals;
      act(() => {
        result.current.bulkAddEmptyLines([], 4);
        result.current.bulkAddEmptyLines(["2030-01-01"], 0);
      });
      expect(result.current.data.meals).toBe(before);
    });
  });

  describe("updateLineAt（行単位の text 更新、F011 経由）", () => {
    it("指定行の text を更新できる", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2030-01-01", "カレー\nサラダ");
      });
      act(() => {
        result.current.updateLineAt("2030-01-01", 1, "コールスロー");
      });
      const lines = result.current.data.meals["2030-01-01"]?.lines ?? [];
      expect(lines.map((l) => l.text)).toEqual(["カレー", "コールスロー"]);
    });

    it("テキスト変更時は done が false にリセットされる（textToLines と同意味論）", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2030-01-01", "カレー");
      });
      act(() => {
        result.current.toggleLine("2030-01-01", 0);
      });
      expect(result.current.data.meals["2030-01-01"]?.lines[0]?.done).toBe(true);
      act(() => {
        result.current.updateLineAt("2030-01-01", 0, "シチュー");
      });
      expect(result.current.data.meals["2030-01-01"]?.lines[0]?.done).toBe(false);
    });

    it("テキスト変更時は cart が解除される", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2030-01-01", "カレー");
      });
      act(() => {
        result.current.toggleCart("2030-01-01", 0);
      });
      expect(result.current.data.meals["2030-01-01"]?.lines[0]?.cart).toBe(true);
      act(() => {
        result.current.updateLineAt("2030-01-01", 0, "シチュー");
      });
      expect(result.current.data.meals["2030-01-01"]?.lines[0]?.cart).toBeUndefined();
    });

    it("同じテキストを渡すと state 識別子が変わらない（no-op）", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2030-01-01", "カレー");
      });
      const before = result.current.data.meals["2030-01-01"];
      act(() => {
        result.current.updateLineAt("2030-01-01", 0, "カレー");
      });
      expect(result.current.data.meals["2030-01-01"]).toBe(before);
    });

    it("範囲外 index は no-op", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2030-01-01", "カレー");
      });
      act(() => {
        result.current.updateLineAt("2030-01-01", 5, "存在しない");
      });
      expect(result.current.data.meals["2030-01-01"]?.lines.length).toBe(1);
    });

    it("更新の結果、全行 text==='' + memo なしになると日付が削除される", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2030-01-01", "カレー");
      });
      act(() => {
        result.current.updateLineAt("2030-01-01", 0, "");
      });
      expect(result.current.data.meals["2030-01-01"]).toBeUndefined();
    });

    it("memo が残っていれば、全行空にしても日付は残る", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2030-01-01", "カレー");
        result.current.setMemo("2030-01-01", "外食");
      });
      act(() => {
        result.current.updateLineAt("2030-01-01", 0, "");
      });
      expect(result.current.data.meals["2030-01-01"]?.memo).toBe("外食");
    });
  });

  describe("addLineAt（行末追加）", () => {
    it("空日に呼ぶと空行が 1 つ末尾に append される", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.addLineAt("2030-01-01", "end");
      });
      expect(result.current.data.meals["2030-01-01"]?.lines.length).toBe(1);
      expect(result.current.data.meals["2030-01-01"]?.lines[0]?.text).toBe("");
    });

    it("既存行がある日に呼ぶと末尾に append される", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2030-01-01", "カレー\nサラダ");
      });
      act(() => {
        result.current.addLineAt("2030-01-01", "end");
      });
      const lines = result.current.data.meals["2030-01-01"]?.lines ?? [];
      expect(lines).toHaveLength(3);
      expect(lines[0]?.text).toBe("カレー");
      expect(lines[1]?.text).toBe("サラダ");
      expect(lines[2]?.text).toBe("");
    });

    it("memo を持つ日に呼んでも memo が保持される", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMemo("2030-01-01", "辛口");
      });
      act(() => {
        result.current.addLineAt("2030-01-01", "end");
      });
      expect(result.current.data.meals["2030-01-01"]?.memo).toBe("辛口");
      expect(result.current.data.meals["2030-01-01"]?.lines.length).toBe(1);
    });
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

    describe("並び替え（reorderStock）", () => {
      it("中間 → 先頭に移動できる", () => {
        const { result } = renderHook(() => useAppData());
        act(() => {
          result.current.addStock("A");
          result.current.addStock("B");
          result.current.addStock("C");
        });
        act(() => {
          result.current.reorderStock(1, 0);
        });
        expect(result.current.data.stock.map((s) => s.text)).toEqual(["B", "A", "C"]);
      });

      it("中間 → 末尾に移動できる", () => {
        const { result } = renderHook(() => useAppData());
        act(() => {
          result.current.addStock("A");
          result.current.addStock("B");
          result.current.addStock("C");
        });
        act(() => {
          result.current.reorderStock(1, 2);
        });
        expect(result.current.data.stock.map((s) => s.text)).toEqual(["A", "C", "B"]);
      });

      it("同じインデックス指定は no-op", () => {
        const { result } = renderHook(() => useAppData());
        act(() => {
          result.current.addStock("A");
          result.current.addStock("B");
        });
        act(() => {
          result.current.reorderStock(0, 0);
        });
        expect(result.current.data.stock.map((s) => s.text)).toEqual(["A", "B"]);
      });

      it("境界外インデックスは no-op", () => {
        const { result } = renderHook(() => useAppData());
        act(() => {
          result.current.addStock("A");
          result.current.addStock("B");
        });
        act(() => {
          result.current.reorderStock(-1, 0);
          result.current.reorderStock(0, 5);
          result.current.reorderStock(5, 0);
        });
        expect(result.current.data.stock.map((s) => s.text)).toEqual(["A", "B"]);
      });

      it("qty は移動後も保持される", () => {
        const { result } = renderHook(() => useAppData());
        act(() => {
          result.current.addStock("A", 5);
          result.current.addStock("B", 2);
        });
        act(() => {
          result.current.reorderStock(0, 1);
        });
        expect(result.current.data.stock[0]?.text).toBe("B");
        expect(result.current.data.stock[0]?.qty).toBe(2);
        expect(result.current.data.stock[1]?.text).toBe("A");
        expect(result.current.data.stock[1]?.qty).toBe(5);
      });
    });

    describe("名前編集（updateStockText）", () => {
      it("指定 id の text を更新できる", () => {
        const { result } = renderHook(() => useAppData());
        act(() => {
          result.current.addStock("グラタン");
        });
        const id = result.current.data.stock[0]?.id ?? "";
        act(() => {
          result.current.updateStockText(id, "下味豚");
        });
        expect(result.current.data.stock[0]?.text).toBe("下味豚");
      });

      it("空文字（trim 後）は no-op で既存テキストが維持される", () => {
        const { result } = renderHook(() => useAppData());
        act(() => {
          result.current.addStock("グラタン");
        });
        const id = result.current.data.stock[0]?.id ?? "";
        act(() => {
          result.current.updateStockText(id, "   ");
        });
        expect(result.current.data.stock[0]?.text).toBe("グラタン");
      });

      it("不明な id は no-op", () => {
        const { result } = renderHook(() => useAppData());
        act(() => {
          result.current.addStock("A");
          result.current.addStock("B");
        });
        act(() => {
          result.current.updateStockText("unknown-id", "X");
        });
        expect(result.current.data.stock.map((s) => s.text)).toEqual(["A", "B"]);
      });

      it("qty は更新時に維持される", () => {
        const { result } = renderHook(() => useAppData());
        act(() => {
          result.current.addStock("A", 3);
        });
        const id = result.current.data.stock[0]?.id ?? "";
        act(() => {
          result.current.updateStockText(id, "B");
        });
        expect(result.current.data.stock[0]?.qty).toBe(3);
      });
    });
  });

  describe("買い物マーカー（行ごと）", () => {
    it("toggleCart で行の cart フラグが立つ", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2026-04-15", "豚バラ大根\nサラダ");
      });
      act(() => {
        result.current.toggleCart("2026-04-15", 0);
      });
      expect(result.current.data.meals["2026-04-15"]?.lines[0]?.cart).toBe(true);
      expect(result.current.data.meals["2026-04-15"]?.lines[1]?.cart).toBeUndefined();
    });

    it("再度 toggleCart で OFF に戻る（cart は未定義に戻り JSON 表現を最小化）", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2026-04-15", "カレー");
      });
      act(() => {
        result.current.toggleCart("2026-04-15", 0);
      });
      expect(result.current.data.meals["2026-04-15"]?.lines[0]?.cart).toBe(true);
      act(() => {
        result.current.toggleCart("2026-04-15", 0);
      });
      expect(result.current.data.meals["2026-04-15"]?.lines[0]?.cart).toBeUndefined();
    });

    it("同じ料理を別日に書いても cart は連動しない（行ごと独立）", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2026-04-15", "豚バラ大根");
        result.current.setMealsText("2026-04-16", "豚バラ大根");
      });
      act(() => {
        result.current.toggleCart("2026-04-15", 0);
      });
      expect(result.current.data.meals["2026-04-15"]?.lines[0]?.cart).toBe(true);
      expect(result.current.data.meals["2026-04-16"]?.lines[0]?.cart).toBeUndefined();
    });

    it("空文字の行は cart 対象外（no-op）", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2026-04-15", "カレー\n");
      });
      act(() => {
        result.current.toggleCart("2026-04-15", 1);
      });
      expect(result.current.data.meals["2026-04-15"]?.lines[1]?.cart).toBeUndefined();
    });

    it("cart は完了/お気に入りと独立してトグルできる", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2026-04-15", "カレー");
      });
      act(() => {
        result.current.toggleCart("2026-04-15", 0);
        result.current.toggleLine("2026-04-15", 0);
        result.current.toggleFavorite("2026-04-15", 0);
      });
      expect(result.current.data.meals["2026-04-15"]?.lines[0]?.cart).toBe(true);
      expect(result.current.data.meals["2026-04-15"]?.lines[0]?.done).toBe(true);
      expect(result.current.data.favorites).toContain(favoriteKey("カレー"));
    });

    it("テキストを変えずに行を編集（同一テキスト）すると cart は維持される", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2026-04-15", "カレー\nサラダ");
      });
      act(() => {
        result.current.toggleCart("2026-04-15", 0);
      });
      // 同じテキストで再 setMealsText しても引き継ぎ
      act(() => {
        result.current.setMealsText("2026-04-15", "カレー\nサラダ");
      });
      expect(result.current.data.meals["2026-04-15"]?.lines[0]?.cart).toBe(true);
    });

    it("行のテキストを変更すると cart はリセットされる", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2026-04-15", "カレー");
      });
      act(() => {
        result.current.toggleCart("2026-04-15", 0);
      });
      expect(result.current.data.meals["2026-04-15"]?.lines[0]?.cart).toBe(true);
      // テキストを書き換える
      act(() => {
        result.current.setMealsText("2026-04-15", "シチュー");
      });
      expect(result.current.data.meals["2026-04-15"]?.lines[0]?.cart).toBeUndefined();
    });

    it("cart 状態は localStorage に永続化される（再読込で復元）", () => {
      const { result, unmount } = renderHook(() => useAppData());
      act(() => {
        result.current.setMealsText("2026-04-15", "カレー");
      });
      act(() => {
        result.current.toggleCart("2026-04-15", 0);
      });
      unmount();
      const { result: result2 } = renderHook(() => useAppData());
      expect(result2.current.data.meals["2026-04-15"]?.lines[0]?.cart).toBe(true);
    });

    it("legacy データ（cart フィールドなし）でも安全に読み込める", () => {
      const legacy = {
        version: 1,
        meals: {
          "2026-04-10": {
            lines: [{ text: "豚バラ大根", done: false }],
          },
        },
        stock: [],
        favorites: [],
      };
      localStorage.setItem("cookpato:data:v1", JSON.stringify(legacy));
      const { result } = renderHook(() => useAppData());
      expect(result.current.data.meals["2026-04-10"]?.lines[0]?.cart).toBeUndefined();
      expect(result.current.data.meals["2026-04-10"]?.lines[0]?.text).toBe("豚バラ大根");
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

  describe("週達成のコミット時トリガーと累積カウント", () => {
    // 2026-04-12 は日曜、2026-04-18 は土曜
    const SUN = "2026-04-12";
    const WEEK = [SUN, "2026-04-13", "2026-04-14", "2026-04-15", "2026-04-16", "2026-04-17"];
    const SAT = "2026-04-18";
    const ALL = [...WEEK, SAT];

    it("初期は justCompletedSunday が null、completedWeeks は空", () => {
      const { result } = renderHook(() => useAppData());
      expect(result.current.justCompletedSunday).toBeNull();
      expect(result.current.data.completedWeeks).toEqual([]);
    });

    it("setMealsText だけでは演出もカウントも発火しない（キーストローク中は静か）", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        for (const d of ALL) result.current.setMealsText(d, "x");
      });
      expect(result.current.justCompletedSunday).toBeNull();
      expect(result.current.data.completedWeeks).toEqual([]);
    });

    /** SAT を埋めて commit までを実 UX の流れで実行（beginEdit → setMealsText → commitEdit） */
    function completeWeekViaCommit(result: { current: ReturnType<typeof useAppData> }): void {
      act(() => {
        for (const d of WEEK) result.current.setMealsText(d, "x");
      });
      act(() => {
        result.current.beginMealsEdit(SAT);
      });
      act(() => {
        result.current.setMealsText(SAT, "x");
      });
      act(() => {
        result.current.commitMealsEdit(SAT);
      });
    }

    it("commitMealsEdit で初めて未達成→達成遷移が確定し、カウントに加算される", () => {
      const { result } = renderHook(() => useAppData());
      // 6 日入れる
      act(() => {
        for (const d of WEEK) result.current.setMealsText(d, "x");
      });
      // 土曜の編集モードに入って baseline を取る（この時点で SAT は未充填）
      act(() => {
        result.current.beginMealsEdit(SAT);
      });
      // 1 文字入力時点ではまだ発火しない
      act(() => {
        result.current.setMealsText(SAT, "x");
      });
      expect(result.current.justCompletedSunday).toBeNull();
      expect(result.current.data.completedWeeks).toEqual([]);
      // blur で commit → ここで発火
      act(() => {
        result.current.commitMealsEdit(SAT);
      });
      expect(result.current.justCompletedSunday).toBe(SUN);
      expect(result.current.data.completedWeeks).toEqual([SUN]);
    });

    it("commit 後に同じ週を再編集して再 commit してもカウントは重複加算されない", () => {
      const { result } = renderHook(() => useAppData());
      completeWeekViaCommit(result);
      expect(result.current.data.completedWeeks).toEqual([SUN]);
      act(() => {
        result.current.clearJustCompleted();
      });
      // 同じ週を編集
      act(() => {
        result.current.beginMealsEdit(SAT);
      });
      act(() => {
        result.current.setMealsText(SAT, "y");
      });
      act(() => {
        result.current.commitMealsEdit(SAT);
      });
      expect(result.current.justCompletedSunday).toBeNull();
      expect(result.current.data.completedWeeks).toEqual([SUN]);
    });

    it("達成済み週の日を空にしてもカウントは減らない", () => {
      const { result } = renderHook(() => useAppData());
      completeWeekViaCommit(result);
      expect(result.current.data.completedWeeks).toEqual([SUN]);
      // 土曜の中身を消す（実 UX の流れ）
      act(() => {
        result.current.beginMealsEdit(SAT);
      });
      act(() => {
        result.current.setMealsText(SAT, "");
      });
      act(() => {
        result.current.commitMealsEdit(SAT);
      });
      // カウントは減らない
      expect(result.current.data.completedWeeks).toEqual([SUN]);
    });

    it("達成済み週を空にして再充填して commit しても演出は出ない＆カウント変化なし", () => {
      const { result } = renderHook(() => useAppData());
      completeWeekViaCommit(result);
      act(() => {
        result.current.clearJustCompleted();
      });
      // 空にする
      act(() => {
        result.current.beginMealsEdit(SAT);
      });
      act(() => {
        result.current.setMealsText(SAT, "");
      });
      act(() => {
        result.current.commitMealsEdit(SAT);
      });
      // 再充填
      act(() => {
        result.current.beginMealsEdit(SAT);
      });
      act(() => {
        result.current.setMealsText(SAT, "z");
      });
      act(() => {
        result.current.commitMealsEdit(SAT);
      });
      expect(result.current.justCompletedSunday).toBeNull();
      expect(result.current.data.completedWeeks).toEqual([SUN]);
    });

    it("別週を達成すると count = 2、justCompletedSunday は新しい週の日曜", () => {
      // 翌週：2026-04-19 (日) 〜 2026-04-25 (土)
      const SUN2 = "2026-04-19";
      const WEEK2 = [SUN2, "2026-04-20", "2026-04-21", "2026-04-22", "2026-04-23", "2026-04-24"];
      const SAT2 = "2026-04-25";
      const { result } = renderHook(() => useAppData());
      completeWeekViaCommit(result);
      act(() => {
        result.current.clearJustCompleted();
      });
      expect(result.current.data.completedWeeks).toEqual([SUN]);
      // 翌週を埋めて commit
      act(() => {
        for (const d of WEEK2) result.current.setMealsText(d, "x");
      });
      act(() => {
        result.current.beginMealsEdit(SAT2);
      });
      act(() => {
        result.current.setMealsText(SAT2, "x");
      });
      act(() => {
        result.current.commitMealsEdit(SAT2);
      });
      expect(result.current.justCompletedSunday).toBe(SUN2);
      expect(result.current.data.completedWeeks).toEqual([SUN, SUN2]);
    });

    it("clearJustCompleted で null に戻せる（completedWeeks は維持）", () => {
      const { result } = renderHook(() => useAppData());
      completeWeekViaCommit(result);
      expect(result.current.justCompletedSunday).toBe(SUN);
      act(() => {
        result.current.clearJustCompleted();
      });
      expect(result.current.justCompletedSunday).toBeNull();
      expect(result.current.data.completedWeeks).toEqual([SUN]);
    });

    it("既存 JSON（completedWeeks 無し）を loadData すると過去の既達成週が遡及カウントされる", () => {
      const legacy = {
        version: 1,
        meals: Object.fromEntries(ALL.map((d) => [d, { lines: [{ text: "x", done: false }] }])),
        stock: [],
        favorites: [],
        // completedWeeks 無し
      };
      localStorage.setItem("cookpato:data:v1", JSON.stringify(legacy));
      const { result } = renderHook(() => useAppData());
      // 起動時に過去の既達成週が認識される
      expect(result.current.data.completedWeeks).toEqual([SUN]);
    });

    it("baseline が無い状態でも commitMealsEdit は安全（no-op）", () => {
      const { result } = renderHook(() => useAppData());
      act(() => {
        for (const d of ALL) result.current.setMealsText(d, "x");
      });
      // begin を呼ばずに commit
      act(() => {
        result.current.commitMealsEdit(SAT);
      });
      // baseline が prev.data.meals にフォールバック → wasComplete = nowComplete = true → 何も起きない
      expect(result.current.justCompletedSunday).toBeNull();
      expect(result.current.data.completedWeeks).toEqual([]);
    });
  });
});
