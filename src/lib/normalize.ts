/**
 * テキスト正規化ロジック。検索のヒット判定に使う。
 *
 * 吸収する表記ゆれ：
 *  - 大文字/小文字
 *  - 全角/半角（英数・カナ）
 *  - ひらがな/カタカナ相互
 *
 * 吸収しない：
 *  - 漢字/かな変換（例：「豚バラ」⇔「ぶたばら」はカナ統一で吸収されるが、「人参」⇔「にんじん」はしない）
 *  - タイポ
 */

/** 全角英数を半角に */
function zenkakuToHankaku(str: string): string {
  return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

/** 半角カナを全角カナに（検索の簡便化のため一度全角に寄せる） */
function hankakuKanaToZenkaku(str: string): string {
  const map: Record<string, string> = {
    ｶﾞ: "ガ",
    ｷﾞ: "ギ",
    ｸﾞ: "グ",
    ｹﾞ: "ゲ",
    ｺﾞ: "ゴ",
    ｻﾞ: "ザ",
    ｼﾞ: "ジ",
    ｽﾞ: "ズ",
    ｾﾞ: "ゼ",
    ｿﾞ: "ゾ",
    ﾀﾞ: "ダ",
    ﾁﾞ: "ヂ",
    ﾂﾞ: "ヅ",
    ﾃﾞ: "デ",
    ﾄﾞ: "ド",
    ﾊﾞ: "バ",
    ﾋﾞ: "ビ",
    ﾌﾞ: "ブ",
    ﾍﾞ: "ベ",
    ﾎﾞ: "ボ",
    ﾊﾟ: "パ",
    ﾋﾟ: "ピ",
    ﾌﾟ: "プ",
    ﾍﾟ: "ペ",
    ﾎﾟ: "ポ",
    ｳﾞ: "ヴ",
    ｱ: "ア",
    ｲ: "イ",
    ｳ: "ウ",
    ｴ: "エ",
    ｵ: "オ",
    ｶ: "カ",
    ｷ: "キ",
    ｸ: "ク",
    ｹ: "ケ",
    ｺ: "コ",
    ｻ: "サ",
    ｼ: "シ",
    ｽ: "ス",
    ｾ: "セ",
    ｿ: "ソ",
    ﾀ: "タ",
    ﾁ: "チ",
    ﾂ: "ツ",
    ﾃ: "テ",
    ﾄ: "ト",
    ﾅ: "ナ",
    ﾆ: "ニ",
    ﾇ: "ヌ",
    ﾈ: "ネ",
    ﾉ: "ノ",
    ﾊ: "ハ",
    ﾋ: "ヒ",
    ﾌ: "フ",
    ﾍ: "ヘ",
    ﾎ: "ホ",
    ﾏ: "マ",
    ﾐ: "ミ",
    ﾑ: "ム",
    ﾒ: "メ",
    ﾓ: "モ",
    ﾔ: "ヤ",
    ﾕ: "ユ",
    ﾖ: "ヨ",
    ﾗ: "ラ",
    ﾘ: "リ",
    ﾙ: "ル",
    ﾚ: "レ",
    ﾛ: "ロ",
    ﾜ: "ワ",
    ｦ: "ヲ",
    ﾝ: "ン",
    ｧ: "ァ",
    ｨ: "ィ",
    ｩ: "ゥ",
    ｪ: "ェ",
    ｫ: "ォ",
    ｬ: "ャ",
    ｭ: "ュ",
    ｮ: "ョ",
    ｯ: "ッ",
    ｰ: "ー",
    "｡": "。",
    "｢": "「",
    "｣": "」",
    "､": "、",
    "･": "・",
  };
  // 濁点付きを先に処理するため、2文字ずつ走査
  let result = "";
  let i = 0;
  while (i < str.length) {
    const two = str.slice(i, i + 2);
    const one = str.slice(i, i + 1);
    if (two in map) {
      result += map[two];
      i += 2;
    } else if (one in map) {
      result += map[one];
      i += 1;
    } else {
      result += one;
      i += 1;
    }
  }
  return result;
}

/** ひらがなをカタカナに */
function hiraganaToKatakana(str: string): string {
  return str.replace(/[\u3041-\u3096]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
}

/**
 * 検索用の正規化。すべての吸収対象を適用して比較可能な形にする。
 */
export function normalize(str: string): string {
  let s = str;
  s = hankakuKanaToZenkaku(s);
  s = zenkakuToHankaku(s);
  s = hiraganaToKatakana(s);
  s = s.toLowerCase();
  return s;
}

/**
 * お気に入りの共有キー。空白区切りの先頭トークンを normalize したものを返す。
 * 例：「豚バラもやし 味噌」「豚ばらもやし」「豚バラもやし」は全て同じキーになる。
 * 空文字や空白のみは "" を返す。
 */
export function favoriteKey(text: string): string {
  const first = text.trim().split(/\s+/)[0] ?? "";
  if (first === "") return "";
  return normalize(first);
}

/**
 * 部分一致判定（正規化後）。
 */
export function includesNormalized(haystack: string, needle: string): boolean {
  if (needle.length === 0) return false;
  return normalize(haystack).includes(normalize(needle));
}

/** 文字列からカタカナのみを抽出（normalize 済み前提） */
export function extractKatakana(s: string): string {
  return s.replace(/[^\u30A0-\u30FF]/g, "");
}

/** a と b の間に長さ minLen 以上の共通連続部分があるか */
export function hasCommonSubstring(a: string, b: string, minLen: number): boolean {
  if (a.length < minLen || b.length < minLen) return false;
  for (let i = 0; i <= a.length - minLen; i++) {
    const sub = a.slice(i, i + minLen);
    if (b.includes(sub)) return true;
  }
  return false;
}
