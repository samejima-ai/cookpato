import { describe, expect, it } from "vitest";
import { includesNormalized, normalize } from "../src/lib/normalize";

describe("normalize", () => {
  it("ひらがなとカタカナを統一する", () => {
    expect(normalize("ぶたばら")).toBe(normalize("ブタバラ"));
    expect(normalize("豚バラ")).toBe(normalize("豚ばら"));
  });

  it("大文字/小文字を統一する", () => {
    expect(normalize("ABC")).toBe(normalize("abc"));
  });

  it("全角英数を半角に揃える", () => {
    expect(normalize("ＡＢＣ123")).toBe(normalize("abc123"));
  });

  it("半角カナを全角カナに揃える", () => {
    expect(normalize("ﾌﾞﾀ")).toBe(normalize("ブタ"));
    expect(normalize("ﾌﾞﾀﾊﾞﾗ")).toBe(normalize("ぶたばら"));
  });
});

describe("includesNormalized", () => {
  it("カタカナ<->ひらがなの相互マッチ", () => {
    expect(includesNormalized("ブタバラ大根", "ぶたばら")).toBe(true);
    expect(includesNormalized("ぶたばら大根", "ブタバラ")).toBe(true);
  });

  it("半角カナの相互マッチ", () => {
    expect(includesNormalized("ﾌﾞﾀﾊﾞﾗ", "ぶたばら")).toBe(true);
  });

  it("漢字は変換対象外：「豚バラ」は「ブタバラ」を部分一致として含まない", () => {
    // includesNormalized は漢字読み解析をしないため false になる
    // （類似マッチは useSearch 側のカナ共通部分検出で拾う）
    expect(includesNormalized("豚バラ大根", "ブタバラ")).toBe(false);
  });

  it("空クエリは一致しない", () => {
    expect(includesNormalized("何か", "")).toBe(false);
  });

  it("無関係な文字列は一致しない", () => {
    expect(includesNormalized("親子丼", "豚バラ")).toBe(false);
  });
});
