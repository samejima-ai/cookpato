import { beforeEach, describe, expect, it } from "vitest";
import {
  coerceAppData,
  isAppDataEffectivelyEmpty,
  loadData,
  loadDataWithRecovery,
  loadLastExport,
  loadSnapshot,
  maybeUpdateSnapshot,
  saveData,
  saveLastExport,
  saveSnapshot,
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

describe("loadSnapshot / saveSnapshot", () => {
  it("保存していない時は null", () => {
    expect(loadSnapshot()).toBeNull();
  });

  it("save → load で同値が取れる", () => {
    const data = makeData({ stock: [{ id: "a", text: "下味豚", qty: 2 }] });
    saveSnapshot("2026-05-05", data);
    const got = loadSnapshot();
    expect(got?.snapshotDate).toBe("2026-05-05");
    expect(got?.data.stock).toEqual(data.stock);
  });

  it("壊れた JSON は null 扱い（throw しない）", () => {
    localStorage.setItem("cookpato:backup:v1", "{not json");
    expect(loadSnapshot()).toBeNull();
  });
});

describe("maybeUpdateSnapshot", () => {
  it("初回は保存される", () => {
    const data = makeData({ favorites: ["豚バラ"] });
    maybeUpdateSnapshot("2026-05-05", data);
    expect(loadSnapshot()?.snapshotDate).toBe("2026-05-05");
  });

  it("同日 2 回目は上書きしない（最初の保存を維持）", () => {
    maybeUpdateSnapshot("2026-05-05", makeData({ favorites: ["a"] }));
    maybeUpdateSnapshot("2026-05-05", makeData({ favorites: ["b"] }));
    expect(loadSnapshot()?.data.favorites).toEqual(["a"]);
  });

  it("日付が変われば上書きする", () => {
    maybeUpdateSnapshot("2026-05-05", makeData({ favorites: ["a"] }));
    maybeUpdateSnapshot("2026-05-06", makeData({ favorites: ["b"] }));
    expect(loadSnapshot()?.data.favorites).toEqual(["b"]);
    expect(loadSnapshot()?.snapshotDate).toBe("2026-05-06");
  });
});

describe("loadDataWithRecovery", () => {
  it("プライマリにデータがあればそのまま返す（復元しない）", () => {
    const primary = makeData({ stock: [{ id: "a", text: "本物", qty: 1 }] });
    saveData(primary);
    saveSnapshot("2026-05-05", makeData({ stock: [{ id: "b", text: "古い", qty: 1 }] }));
    const { data, restored } = loadDataWithRecovery();
    expect(restored).toBe(false);
    expect(data.stock[0]?.text).toBe("本物");
  });

  it("プライマリ空 + 有効スナップショットなら復元してプライマリへ書き戻す", () => {
    const snapshot = makeData({
      stock: [{ id: "a", text: "復元対象", qty: 2 }],
      favorites: ["豚バラ"],
    });
    saveSnapshot("2026-05-04", snapshot);
    const { data, restored } = loadDataWithRecovery();
    expect(restored).toBe(true);
    expect(data.stock[0]?.text).toBe("復元対象");
    // プライマリにも書き戻されている
    expect(loadData().stock[0]?.text).toBe("復元対象");
  });

  it("プライマリ空 + スナップショットなしなら復元しない", () => {
    const { data, restored } = loadDataWithRecovery();
    expect(restored).toBe(false);
    expect(isAppDataEffectivelyEmpty(data)).toBe(true);
  });

  it("プライマリ空 + スナップショットも空なら復元しない（無限復元防止）", () => {
    saveSnapshot("2026-05-04", makeData());
    const { data, restored } = loadDataWithRecovery();
    expect(restored).toBe(false);
    expect(isAppDataEffectivelyEmpty(data)).toBe(true);
  });

  it("プライマリが壊れていて + 有効スナップショットなら復元する", () => {
    localStorage.setItem("cookpato:data:v1", "{garbage");
    saveSnapshot("2026-05-04", makeData({ stock: [{ id: "a", text: "救出", qty: 1 }] }));
    const { data, restored } = loadDataWithRecovery();
    expect(restored).toBe(true);
    expect(data.stock[0]?.text).toBe("救出");
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
