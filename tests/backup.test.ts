import { describe, expect, it } from "vitest";
import { parseBackup, serializeBackup } from "../src/lib/backup";
import type { AppData } from "../src/types";

function makeData(overrides: Partial<AppData> = {}): AppData {
  return {
    version: 1,
    meals: {},
    stock: [],
    favorites: [],
    completedWeeks: [],
    ...overrides,
  };
}

describe("serializeBackup", () => {
  it("インデント 2 の整形 JSON を返す（人間可読）", () => {
    const text = serializeBackup(makeData({ stock: [{ id: "a", text: "下味豚", qty: 3 }] }));
    expect(text).toContain('\n  "stock": [');
    expect(text).toContain('"text": "下味豚"');
  });
});

describe("serializeBackup / parseBackup", () => {
  it("往復で同じ AppData が取れる", () => {
    const data = makeData({
      stock: [{ id: "a", text: "下味豚", qty: 3 }],
      favorites: ["豚バラ"],
      meals: {
        "2026-04-15": { lines: [{ text: "カレー", done: true }] },
      },
    });
    const text = serializeBackup(data);
    const parsed = parseBackup(text);
    expect(parsed?.stock).toEqual(data.stock);
    expect(parsed?.favorites).toEqual(data.favorites);
    expect(parsed?.meals["2026-04-15"]?.lines[0]?.text).toBe("カレー");
  });

  it("空データは拒否（誤適用での全消し防止）", () => {
    expect(parseBackup(serializeBackup(makeData()))).toBeNull();
  });

  it("不正な JSON は null", () => {
    expect(parseBackup("{garbage")).toBeNull();
  });

  it("AppData 形式でない JSON は null（実質空に寄せられた結果）", () => {
    expect(parseBackup(JSON.stringify({ foo: "bar" }))).toBeNull();
  });
});
