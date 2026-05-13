import { beforeEach, describe, expect, it } from "vitest";
import {
  coerceAppData,
  isAppDataEffectivelyEmpty,
  loadData,
  loadLastExport,
  saveData,
  saveLastExport,
} from "../src/lib/storage";
import type { AppData } from "../src/types";

beforeEach(() => {
  localStorage.clear();
});

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

describe("isAppDataEffectivelyEmpty", () => {
  it("全フィールド空なら true", () => {
    expect(isAppDataEffectivelyEmpty(makeData())).toBe(true);
  });

  it("meals に1日でもデータがあれば false", () => {
    expect(
      isAppDataEffectivelyEmpty(
        makeData({
          meals: { "2026-04-15": { lines: [{ text: "カレー", done: false }] } },
        }),
      ),
    ).toBe(false);
  });

  it("stock に項目があれば false", () => {
    expect(
      isAppDataEffectivelyEmpty(
        makeData({
          stock: [{ id: "a", text: "下味豚", qty: 3 }],
        }),
      ),
    ).toBe(false);
  });

  it("favorites に項目があれば false", () => {
    expect(isAppDataEffectivelyEmpty(makeData({ favorites: ["豚バラ"] }))).toBe(false);
  });
});

describe("coerceAppData", () => {
  it("不正な入力は初期値（空）に寄せる", () => {
    expect(isAppDataEffectivelyEmpty(coerceAppData(null))).toBe(true);
    expect(isAppDataEffectivelyEmpty(coerceAppData("not json"))).toBe(true);
    expect(isAppDataEffectivelyEmpty(coerceAppData({ version: 99 }))).toBe(true);
  });

  it("正常な入力は欠損なく復元される", () => {
    const input = makeData({
      meals: { "2026-04-15": { lines: [{ text: "カレー", done: false }] } },
      stock: [{ id: "a", text: "下味豚", qty: 3 }],
      favorites: ["豚バラ"],
    });
    const out = coerceAppData(input);
    expect(out.stock).toEqual(input.stock);
    expect(out.favorites).toEqual(input.favorites);
    expect(out.meals["2026-04-15"]?.lines[0]?.text).toBe("カレー");
  });

  it("stock の不正項目は除外する", () => {
    const out = coerceAppData({
      version: 1,
      meals: {},
      stock: [
        { id: "a", text: "下味豚", qty: 2 },
        { id: 123 }, // 不正
        null, // 不正
        { text: "id無し", qty: 1 }, // 不正
      ],
      favorites: [],
      completedWeeks: [],
    });
    expect(out.stock).toEqual([{ id: "a", text: "下味豚", qty: 2 }]);
  });
});

describe("loadData", () => {
  it("初期は空データ", () => {
    expect(isAppDataEffectivelyEmpty(loadData())).toBe(true);
  });

  it("save → load で同値が取れる", () => {
    const data = makeData({ stock: [{ id: "a", text: "下味豚", qty: 2 }] });
    saveData(data);
    expect(loadData().stock).toEqual(data.stock);
  });

  it("壊れた JSON は初期値に寄せる（throw しない）", () => {
    localStorage.setItem("cookpato:data:v1", "{garbage");
    expect(isAppDataEffectivelyEmpty(loadData())).toBe(true);
  });
});

describe("loadLastExport / saveLastExport", () => {
  it("初期は null", () => {
    expect(loadLastExport()).toBeNull();
  });

  it("save → load で同値が取れる", () => {
    saveLastExport("2026-05-05");
    expect(loadLastExport()).toBe("2026-05-05");
  });
});
