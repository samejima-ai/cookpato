import { describe, expect, it } from "vitest";
import { getHolidayName, isHoliday } from "../src/lib/holidays";

describe("holidays lib", () => {
  it("isHoliday は祝日に true を返す", () => {
    expect(isHoliday("2026-05-05")).toBe(true); // こどもの日
    expect(isHoliday("2026-04-29")).toBe(true); // 昭和の日
    expect(isHoliday("2026-01-01")).toBe(true); // 元日
  });

  it("isHoliday は平日に false を返す", () => {
    expect(isHoliday("2026-05-07")).toBe(false);
    expect(isHoliday("2026-04-15")).toBe(false);
  });

  it("getHolidayName は祝日名を返す", () => {
    expect(getHolidayName("2026-05-05")).toBe("こどもの日");
    expect(getHolidayName("2026-04-29")).toBe("昭和の日");
    expect(getHolidayName("2026-01-01")).toBe("元日");
  });

  it("getHolidayName は平日には null を返す", () => {
    expect(getHolidayName("2026-05-07")).toBeNull();
    expect(getHolidayName("2026-04-15")).toBeNull();
  });
});
