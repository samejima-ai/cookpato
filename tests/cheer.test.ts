import { describe, expect, it } from "vitest";
import { computeCheerDates } from "../src/lib/cheer";
import type { DayMeals } from "../src/types";

const TODAY = "2026-04-16";
const LOOKAHEAD = 60;

// 行テキスト "x" を持つ埋まった DayMeals を作る
function filled(text = "x"): DayMeals {
  return { lines: [{ text, done: false }] };
}

// 空の DayMeals（明示的に 1 行空）を作る
function emptyOneLine(): DayMeals {
  return { lines: [{ text: "", done: false }] };
}

describe("computeCheerDates", () => {
  it("meals が空なら明日から 7 日間が対象", () => {
    const result = computeCheerDates({}, TODAY, LOOKAHEAD);
    expect(result.size).toBe(7);
    expect(result.has("2026-04-17")).toBe(true); // today+1
    expect(result.has("2026-04-23")).toBe(true); // today+7
    expect(result.has("2026-04-24")).toBe(false); // window 外
  });

  it("lookahead 内が全部埋まっていれば空 Set", () => {
    // lookahead=5 に縮めて、その範囲内をすべて埋めて anchor が見つからないケース
    const filledMeals: Record<string, DayMeals> = {
      "2026-04-17": filled(),
      "2026-04-18": filled(),
      "2026-04-19": filled(),
      "2026-04-20": filled(),
      "2026-04-21": filled(),
    };
    const result = computeCheerDates(filledMeals, TODAY, 5);
    expect(result.size).toBe(0);
  });

  it("today+3 が最初の空日、他の未来日が埋まっていれば対象は today+3 のみ", () => {
    const meals: Record<string, DayMeals> = {
      "2026-04-17": filled(),
      "2026-04-18": filled(),
      // 2026-04-19 (today+3) が空
      "2026-04-20": filled(),
      "2026-04-21": filled(),
      "2026-04-22": filled(),
      "2026-04-23": filled(),
      "2026-04-24": filled(),
      "2026-04-25": filled(),
    };
    const result = computeCheerDates(meals, TODAY, LOOKAHEAD);
    expect(Array.from(result)).toEqual(["2026-04-19"]);
  });

  it("anchor から 7 日ウィンドウ内の複数空日を全部拾う", () => {
    const meals: Record<string, DayMeals> = {
      "2026-04-17": filled(),
      "2026-04-18": filled(),
      // 04-19 (anchor)
      "2026-04-20": filled(),
      // 04-21 も空
      "2026-04-22": filled(),
      // 04-23 も空
      "2026-04-24": filled(),
      // 04-25 も空（anchor+6、ウィンドウの最終日）
      "2026-04-26": filled(), // anchor+7 日目（ウィンドウ外）
    };
    const result = computeCheerDates(meals, TODAY, LOOKAHEAD);
    expect(result.has("2026-04-19")).toBe(true);
    expect(result.has("2026-04-21")).toBe(true);
    expect(result.has("2026-04-23")).toBe(true);
    expect(result.has("2026-04-25")).toBe(true); // anchor+6、window 内
    expect(result.has("2026-04-26")).toBe(false); // anchor+7、window 外
    expect(result.size).toBe(4);
  });

  it("anchor より離れた空日はウィンドウ外なら含まれない", () => {
    const meals: Record<string, DayMeals> = {
      "2026-04-17": filled(),
      "2026-04-18": filled(),
      // 04-19 (anchor, today+3)
      "2026-04-20": filled(),
      "2026-04-21": filled(),
      "2026-04-22": filled(),
      "2026-04-23": filled(),
      "2026-04-24": filled(),
      "2026-04-25": filled(),
      "2026-04-26": filled(),
      // 04-27 が空だが anchor+8 なのでウィンドウ外
    };
    const result = computeCheerDates(meals, TODAY, LOOKAHEAD);
    expect(Array.from(result)).toEqual(["2026-04-19"]);
  });

  it("今日が空でも対象外", () => {
    const meals: Record<string, DayMeals> = {
      "2026-04-16": emptyOneLine(), // 今日、空
      "2026-04-17": filled(),
      "2026-04-18": filled(),
      "2026-04-19": filled(),
      "2026-04-20": filled(),
      "2026-04-21": filled(),
    };
    const result = computeCheerDates(meals, TODAY, 5);
    // 今日は対象外、未来日はすべて埋まっているので空
    expect(result.has("2026-04-16")).toBe(false);
    expect(result.size).toBe(0);
  });

  it("過去日が空でも影響しない", () => {
    const meals: Record<string, DayMeals> = {
      "2026-04-10": emptyOneLine(), // 過去、空
      "2026-04-15": filled(), // 過去、埋まってる
      // 未来はすべて空（明示エントリなし = 空）
    };
    const result = computeCheerDates(meals, TODAY, LOOKAHEAD);
    expect(result.has("2026-04-10")).toBe(false);
    expect(result.has("2026-04-15")).toBe(false);
    // 未来は明日 (04-17) から 7 日分
    expect(result.has("2026-04-17")).toBe(true);
    expect(result.size).toBe(7);
  });
});
