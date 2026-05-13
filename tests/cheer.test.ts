import { describe, expect, it } from "vitest";
import {
  CHEER_AUTO_LINE_COUNT,
  computeCheerDates,
  computeCheerWindow,
  isEmptyDay,
} from "../src/lib/cheer";
import type { DayMeals } from "../src/types";

const TODAY = "2026-04-16";

// 行テキスト "x" を持つ埋まった DayMeals を作る
function filled(text = "x"): DayMeals {
  return { lines: [{ text, done: false }] };
}

// 空の DayMeals（明示的に 1 行空）を作る
function emptyOneLine(): DayMeals {
  return { lines: [{ text: "", done: false }] };
}

// 自動生成された 4 空行を持つ DayMeals を作る
function autoEmpty(): DayMeals {
  return {
    lines: Array.from({ length: CHEER_AUTO_LINE_COUNT }, () => ({ text: "", done: false })),
  };
}

describe("isEmptyDay", () => {
  it("undefined は空日扱い", () => {
    expect(isEmptyDay(undefined)).toBe(true);
  });

  it("lines 0 個は空日扱い", () => {
    expect(isEmptyDay({ lines: [] })).toBe(true);
  });

  it("1 行で text=='' は空日扱い", () => {
    expect(isEmptyDay(emptyOneLine())).toBe(true);
  });

  it("4 行すべて text=='' は空日扱い（起動時自動生成された日）", () => {
    expect(isEmptyDay(autoEmpty())).toBe(true);
  });

  it("1 行でも text 非空なら空日ではない", () => {
    expect(isEmptyDay(filled())).toBe(false);
  });

  it("4 行中 1 行だけ text 入りでも空日ではない", () => {
    const day: DayMeals = {
      lines: [
        { text: "", done: false },
        { text: "カレー", done: false },
        { text: "", done: false },
        { text: "", done: false },
      ],
    };
    expect(isEmptyDay(day)).toBe(false);
  });

  it("memo があっても lines が全て空なら空日扱い（memo は判定対象外）", () => {
    expect(isEmptyDay({ lines: [], memo: "外食" })).toBe(true);
  });
});

describe("computeCheerDates", () => {
  it("meals が空なら today から 7 日間すべてが対象", () => {
    const result = computeCheerDates({}, TODAY);
    expect(result.size).toBe(7);
    expect(result.has("2026-04-16")).toBe(true); // today
    expect(result.has("2026-04-22")).toBe(true); // today+6
    expect(result.has("2026-04-23")).toBe(false); // today+7 は対象外
  });

  it("今日が空なら今日も対象に含まれる", () => {
    const meals: Record<string, DayMeals> = {
      "2026-04-16": emptyOneLine(),
      "2026-04-17": filled(),
      "2026-04-18": filled(),
      "2026-04-19": filled(),
      "2026-04-20": filled(),
      "2026-04-21": filled(),
      "2026-04-22": filled(),
    };
    const result = computeCheerDates(meals, TODAY);
    expect(Array.from(result)).toEqual(["2026-04-16"]);
  });

  it("ウィンドウ内の一部だけ空なら空日のみを拾う", () => {
    const meals: Record<string, DayMeals> = {
      "2026-04-16": filled(), // today
      "2026-04-17": filled(),
      "2026-04-18": filled(),
      // 2026-04-19 (today+3) が空
      "2026-04-20": filled(),
      "2026-04-21": filled(),
      "2026-04-22": filled(),
    };
    const result = computeCheerDates(meals, TODAY);
    expect(Array.from(result)).toEqual(["2026-04-19"]);
  });

  it("ウィンドウ内に複数の空日があればすべて拾う", () => {
    const meals: Record<string, DayMeals> = {
      "2026-04-16": filled(), // today
      // 04-17 空
      "2026-04-18": filled(),
      // 04-19 空
      "2026-04-20": filled(),
      // 04-21 空
      "2026-04-22": filled(), // today+6、ウィンドウ最終日
    };
    const result = computeCheerDates(meals, TODAY);
    expect(result.has("2026-04-17")).toBe(true);
    expect(result.has("2026-04-19")).toBe(true);
    expect(result.has("2026-04-21")).toBe(true);
    expect(result.size).toBe(3);
  });

  it("today+7 が空でもウィンドウ外なので含まれない", () => {
    const meals: Record<string, DayMeals> = {
      "2026-04-16": filled(),
      "2026-04-17": filled(),
      "2026-04-18": filled(),
      "2026-04-19": filled(),
      "2026-04-20": filled(),
      "2026-04-21": filled(),
      "2026-04-22": filled(),
      // 2026-04-23 (today+7) が空だがウィンドウ外
    };
    const result = computeCheerDates(meals, TODAY);
    expect(result.size).toBe(0);
  });

  it("過去日が空でも対象外", () => {
    const meals: Record<string, DayMeals> = {
      "2026-04-10": emptyOneLine(), // 過去、空
      "2026-04-15": emptyOneLine(), // 昨日、空
      // today〜today+6 はすべて埋まる
      "2026-04-16": filled(),
      "2026-04-17": filled(),
      "2026-04-18": filled(),
      "2026-04-19": filled(),
      "2026-04-20": filled(),
      "2026-04-21": filled(),
      "2026-04-22": filled(),
    };
    const result = computeCheerDates(meals, TODAY);
    expect(result.has("2026-04-10")).toBe(false);
    expect(result.has("2026-04-15")).toBe(false);
    expect(result.size).toBe(0);
  });

  it("ウィンドウ内に自動生成された 4 空行の日があれば空日扱い（拡張定義）", () => {
    const meals: Record<string, DayMeals> = {
      "2026-04-16": autoEmpty(), // today、自動生成 4 空行
      "2026-04-17": filled(),
      "2026-04-18": filled(),
      "2026-04-19": filled(),
      "2026-04-20": filled(),
      "2026-04-21": filled(),
      "2026-04-22": filled(),
    };
    const result = computeCheerDates(meals, TODAY);
    expect(Array.from(result)).toEqual(["2026-04-16"]);
  });

  it("ウィンドウ全日埋まっていれば空 Set（入力状態に依存する）", () => {
    const meals: Record<string, DayMeals> = {
      "2026-04-16": filled(),
      "2026-04-17": filled(),
      "2026-04-18": filled(),
      "2026-04-19": filled(),
      "2026-04-20": filled(),
      "2026-04-21": filled(),
      "2026-04-22": filled(),
    };
    const result = computeCheerDates(meals, TODAY);
    expect(result.size).toBe(0);
  });
});

describe("computeCheerWindow", () => {
  it("today から 7 日分の DateKey を返す（入力状態に依存しない）", () => {
    const result = computeCheerWindow(TODAY);
    expect(result.size).toBe(7);
    expect(result.has("2026-04-16")).toBe(true); // today
    expect(result.has("2026-04-17")).toBe(true);
    expect(result.has("2026-04-22")).toBe(true); // today+6
    expect(result.has("2026-04-23")).toBe(false); // today+7 は対象外
    expect(result.has("2026-04-15")).toBe(false); // 昨日は対象外
  });

  it("meals 引数を取らないため、部分入力でも範囲は変わらない", () => {
    // computeCheerDates は meals 依存で「全空日」のみだが、computeCheerWindow は範囲のみ。
    // 1 行入力された日も範囲内であれば結果に含まれる。
    const result = computeCheerWindow(TODAY);
    expect(result.has("2026-04-16")).toBe(true);
  });
});
