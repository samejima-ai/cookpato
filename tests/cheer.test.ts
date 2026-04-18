import { describe, expect, it } from "vitest";
import { computeCheerDates } from "../src/lib/cheer";
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

  it("ウィンドウ全日埋まっていれば空 Set", () => {
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
