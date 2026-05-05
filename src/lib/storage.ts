/**
 * localStorage ラッパー。単一キー "cookpato:data:v1" に AppData を JSON で保存。
 * 読み書きエラーは黙って初期値を返す（単一ユーザー・シンプル運用のため）。
 *
 * バックアップ層：
 * - "cookpato:backup:v1": A 層スナップショット { snapshotDate, data }
 * - "cookpato:lastExport:v1": B 層の最終ファイル書き出し日（DateKey 文字列）
 */
import type { AppData, DateKey, DayMeals, StockItem } from "../types";
import { computeAllCompleteWeekSundays } from "./week";

const STORAGE_KEY = "cookpato:data:v1";
const SNAPSHOT_KEY = "cookpato:backup:v1";
const LAST_EXPORT_KEY = "cookpato:lastExport:v1";

/** A 層スナップショット形式 */
export type Snapshot = {
  snapshotDate: DateKey;
  data: AppData;
};

function initialData(): AppData {
  return {
    version: 1,
    meals: {},
    stock: [],
    favorites: [],
    completedWeeks: [],
  };
}

/**
 * 任意の入力（JSON.parse 結果やスナップショット data 等）を AppData として安全化する。
 * 既存の loadData ロジックを切り出してインポート復元でも再利用できるようにしたもの。
 * 不正値は初期値・空配列に寄せて返す（throw しない）。
 */
export function coerceAppData(parsed: unknown): AppData {
  if (!isBaseShape(parsed)) return initialData();
  const stock = parsed.stock.map(coerceStockItem).filter((s): s is StockItem => s !== null);
  const favorites = Array.isArray(parsed.favorites)
    ? parsed.favorites.filter((v): v is string => typeof v === "string")
    : [];
  const meals = coerceMeals(parsed.meals);
  const stored = Array.isArray(parsed.completedWeeks)
    ? parsed.completedWeeks.filter((v): v is string => typeof v === "string")
    : [];
  const completedWeeks = unionSorted(stored, computeAllCompleteWeekSundays(meals));
  return {
    version: 1,
    meals,
    stock,
    favorites,
    completedWeeks,
  };
}

/** 安全に読み込む。必須フィールド欠落や型不整合は初期値に寄せる */
export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialData();
    const parsed = JSON.parse(raw) as unknown;
    return coerceAppData(parsed);
  } catch {
    return initialData();
  }
}

function unionSorted(a: DateKey[], b: DateKey[]): DateKey[] {
  const set = new Set<DateKey>();
  for (const v of a) set.add(v);
  for (const v of b) set.add(v);
  return Array.from(set).sort();
}

/** 安全に保存する（例外は握りつぶす） */
export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 書き込み失敗は許容（容量不足等）。次回入力で再試行される
  }
}

/** A 層スナップショットを読む。形式不正なら null を返す */
export function loadSnapshot(): Snapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const o = parsed as Record<string, unknown>;
    if (typeof o.snapshotDate !== "string") return null;
    const data = coerceAppData(o.data);
    return { snapshotDate: o.snapshotDate, data };
  } catch {
    return null;
  }
}

/** A 層スナップショットを書く（例外は握りつぶす） */
export function saveSnapshot(snapshotDate: DateKey, data: AppData): void {
  try {
    const payload: Snapshot = { snapshotDate, data };
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(payload));
  } catch {
    // 容量不足等で書けなくても運用継続
  }
}

/** B 層：最終ファイル書き出し日（DateKey）を読む */
export function loadLastExport(): DateKey | null {
  try {
    const raw = localStorage.getItem(LAST_EXPORT_KEY);
    return typeof raw === "string" && raw !== "" ? raw : null;
  } catch {
    return null;
  }
}

/** B 層：最終ファイル書き出し日を書く */
export function saveLastExport(date: DateKey): void {
  try {
    localStorage.setItem(LAST_EXPORT_KEY, date);
  } catch {
    // 失敗時もユーザー体験は止めない
  }
}

/** AppData が「実質空」か（meals/stock/favorites/completedWeeks すべて空） */
export function isAppDataEffectivelyEmpty(data: AppData): boolean {
  return (
    Object.keys(data.meals).length === 0 &&
    data.stock.length === 0 &&
    data.favorites.length === 0 &&
    data.completedWeeks.length === 0
  );
}

/**
 * A 層復元込みでデータを読む。
 * プライマリが「実質空」かつスナップショットに有効データがあれば復元してプライマリへ書き戻す。
 * 戻り値の `restored` は復元発火のトースト表示判定に使う。
 */
export function loadDataWithRecovery(): { data: AppData; restored: boolean } {
  const primary = loadData();
  if (!isAppDataEffectivelyEmpty(primary)) {
    return { data: primary, restored: false };
  }
  const snapshot = loadSnapshot();
  if (!snapshot || isAppDataEffectivelyEmpty(snapshot.data)) {
    return { data: primary, restored: false };
  }
  saveData(snapshot.data);
  return { data: snapshot.data, restored: true };
}

/**
 * 1 日 1 回相当のスナップショット更新。
 * 既存スナップショットの snapshotDate が today と異なる場合のみ書き換える。
 */
export function maybeUpdateSnapshot(today: DateKey, data: AppData): void {
  const existing = loadSnapshot();
  if (existing && existing.snapshotDate === today) return;
  saveSnapshot(today, data);
}

type BaseShape = {
  version: 1;
  meals: object;
  stock: unknown[];
  favorites?: unknown;
  completedWeeks?: unknown;
};

function isBaseShape(v: unknown): v is BaseShape {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    o.version === 1 && typeof o.meals === "object" && o.meals !== null && Array.isArray(o.stock)
  );
}

/** meals の形を最低限安全にする。memo は文字列のみ許容、他は空で落とす */
function coerceMeals(raw: unknown): Record<string, DayMeals> {
  if (typeof raw !== "object" || raw === null) return {};
  const result: Record<string, DayMeals> = {};
  for (const [date, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "object" || value === null) continue;
    const v = value as Record<string, unknown>;
    const lines = Array.isArray(v.lines)
      ? v.lines
          .map((l) => {
            if (typeof l !== "object" || l === null) return null;
            const line = l as Record<string, unknown>;
            if (typeof line.text !== "string") return null;
            const result: { text: string; done: boolean; cart?: boolean } = {
              text: line.text,
              done: line.done === true,
            };
            if (line.cart === true) result.cart = true;
            return result;
          })
          .filter((x): x is { text: string; done: boolean; cart?: boolean } => x !== null)
      : [];
    const day: DayMeals = { lines };
    if (typeof v.memo === "string" && v.memo !== "") day.memo = v.memo;
    result[date] = day;
  }
  return result;
}

function coerceStockItem(raw: unknown): StockItem | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.text !== "string") return null;
  const qty =
    typeof o.qty === "number" && Number.isFinite(o.qty) ? Math.max(0, Math.floor(o.qty)) : 1;
  return { id: o.id, text: o.text, qty };
}
