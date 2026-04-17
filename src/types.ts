/**
 * Cookpato のドメイン型定義。
 * 全ての型はここに集約する（検索容易性・重複防止のため）。
 */

/** 日付を表す文字列（ISO: YYYY-MM-DD 形式、ローカルタイムゾーン基準） */
export type DateKey = string;

/** 1品を表す行。行インデックスで完了状態を管理する */
export type MealLine = {
  /** 入力テキスト（ユーザーの表記をそのまま保持） */
  text: string;
  /** 完了済みか */
  done: boolean;
};

/** 1日分の献立 */
export type DayMeals = {
  /** 行の配列（入力順、並び替え不可。追加・削除のみ） */
  lines: MealLine[];
  /**
   * ちょい書き用メモ。料理行とは別枠の自由記述1行（例：「遅くなる」「外食」）。
   * 料理名ではないため、検索・完了トグル・お気に入り・週達成判定の対象外。
   */
  memo?: string;
};

/** ストックリストの1項目 */
export type StockItem = {
  /** 安定した一意ID */
  id: string;
  /** 表示テキスト */
  text: string;
  /** 個数（0 になると削除確認 UI に変化する。復帰可能） */
  qty: number;
};

/** localStorage に保存する全体データ */
export type AppData = {
  version: 1;
  meals: Record<DateKey, DayMeals>;
  stock: StockItem[];
  /** お気に入り（正規化テキストの集合）。同じ料理を別日に書いても共通でマーキングされる */
  favorites: string[];
};

/** 検索結果1件 */
export type SearchHit = {
  date: DateKey;
  /** その日の全行（表示用） */
  lines: MealLine[];
  /** 一致の種類 */
  matchKind: "exact" | "similar";
};
