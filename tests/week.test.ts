import { describe, expect, it } from "vitest";
import { computeCompleteWeekSundays, isWeekComplete } from "../src/lib/week";
import type { DayMeals } from "../src/types";

function filled(text = "x"): DayMeals {
  return { lines: [{ text, done: false }] };
}

function empty1(): DayMeals {
  return { lines: [{ text: "", done: false }] };
}

// 2026-04-12 は日曜、2026-04-18 は土曜
const SUN = "2026-04-12";
const MON = "2026-04-13";
const TUE = "2026-04-14";
const WED = "2026-04-15";
const THU = "2026-04-16";
const FRI = "2026-04-17";
const SAT = "2026-04-18";

describe("isWeekComplete", () => {
  it("日〜土が全て埋まっていれば true（日曜指定）", () => {
    const meals: Record<string, DayMeals> = {
      [SUN]: filled(),
      [MON]: filled(),
      [TUE]: filled(),
      [WED]: filled(),
      [THU]: filled(),
      [FRI]: filled(),
      [SAT]: filled(),
    };
    expect(isWeekComplete(meals, SUN)).toBe(true);
  });

  it("週中日を指定しても同じ週として判定される", () => {
    const meals: Record<string, DayMeals> = {
      [SUN]: filled(),
      [MON]: filled(),
      [TUE]: filled(),
      [WED]: filled(),
      [THU]: filled(),
      [FRI]: filled(),
      [SAT]: filled(),
    };
    expect(isWeekComplete(meals, WED)).toBe(true);
    expect(isWeekComplete(meals, SAT)).toBe(true);
  });

  it("1 日でも欠ければ false", () => {
    const meals: Record<string, DayMeals> = {
      [SUN]: filled(),
      [MON]: filled(),
      [TUE]: filled(),
      [WED]: filled(),
      [THU]: filled(),
      [FRI]: filled(),
      // SAT 欠落
    };
    expect(isWeekComplete(meals, SUN)).toBe(false);
  });

  it("1 行だけの空文字エントリは埋まってない扱い", () => {
    const meals: Record<string, DayMeals> = {
      [SUN]: filled(),
      [MON]: filled(),
      [TUE]: filled(),
      [WED]: empty1(),
      [THU]: filled(),
      [FRI]: filled(),
      [SAT]: filled(),
    };
    expect(isWeekComplete(meals, SUN)).toBe(false);
  });
});

describe("computeCompleteWeekSundays", () => {
  it("範囲内で満タン週だけを日曜キーで返す", () => {
    // 2026-04-12..18 を満タン、翌週は欠落
    const meals: Record<string, DayMeals> = {
      [SUN]: filled(),
      [MON]: filled(),
      [TUE]: filled(),
      [WED]: filled(),
      [THU]: filled(),
      [FRI]: filled(),
      [SAT]: filled(),
      "2026-04-19": filled(), // 翌週日曜だけ埋まってる
    };
    // 範囲 2026-04-10..2026-04-25 を走査
    const result = computeCompleteWeekSundays(meals, "2026-04-10", "2026-04-25");
    expect(result.has(SUN)).toBe(true);
    expect(result.has("2026-04-19")).toBe(false); // 翌週は満タンじゃない
    expect(result.size).toBe(1);
  });

  it("満タン週が複数あれば全部返す", () => {
    const meals: Record<string, DayMeals> = {};
    // 2026-04-12..18
    for (const d of [SUN, MON, TUE, WED, THU, FRI, SAT]) meals[d] = filled();
    // 2026-04-19..25
    for (const d of [
      "2026-04-19",
      "2026-04-20",
      "2026-04-21",
      "2026-04-22",
      "2026-04-23",
      "2026-04-24",
      "2026-04-25",
    ]) {
      meals[d] = filled();
    }
    const result = computeCompleteWeekSundays(meals, "2026-04-10", "2026-04-30");
    expect(result.has(SUN)).toBe(true);
    expect(result.has("2026-04-19")).toBe(true);
    expect(result.size).toBe(2);
  });

  it("空 meals なら空 Set", () => {
    const result = computeCompleteWeekSundays({}, "2026-04-10", "2026-04-30");
    expect(result.size).toBe(0);
  });
});
