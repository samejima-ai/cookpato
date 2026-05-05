import { describe, expect, it } from "vitest";
import {
  formatISOWeek,
  getBackupFilename,
  parseBackup,
  serializeBackup,
  shouldShowExportBanner,
} from "../src/lib/backup";
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

describe("formatISOWeek", () => {
  it("月曜は同じ ISO 週で扱う", () => {
    expect(formatISOWeek(new Date("2026-04-27T00:00:00"))).toBe("2026-W18");
  });

  it("週番号は 2 桁ゼロ詰め", () => {
    expect(formatISOWeek(new Date("2026-01-05T00:00:00"))).toMatch(/^2026-W\d{2}$/);
  });
});

describe("getBackupFilename", () => {
  it("ISO 週入りのファイル名を返す", () => {
    const name = getBackupFilename(new Date("2026-04-27T00:00:00"));
    expect(name).toBe("cookpato-backup-2026-W18.json");
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

describe("shouldShowExportBanner", () => {
  it("未エクスポート（null）なら表示", () => {
    expect(shouldShowExportBanner(null, "2026-05-05")).toBe(true);
  });

  it("7 日経過していれば表示", () => {
    expect(shouldShowExportBanner("2026-04-28", "2026-05-05")).toBe(true);
  });

  it("7 日未満なら非表示", () => {
    expect(shouldShowExportBanner("2026-04-29", "2026-05-05")).toBe(false);
  });

  it("同日（0 日差）なら非表示", () => {
    expect(shouldShowExportBanner("2026-05-05", "2026-05-05")).toBe(false);
  });

  it("不正な日付は安全側（表示）に倒す", () => {
    expect(shouldShowExportBanner("not-a-date", "2026-05-05")).toBe(true);
  });
});
