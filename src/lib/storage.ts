/**
 * localStorage ラッパー。単一キー "cookpato:data:v1" に AppData を JSON で保存。
 * 読み書きエラーは黙って初期値を返す（単一ユーザー・シンプル運用のため）。
 */
import type { AppData, DayMeals, StockItem } from "../types";

const STORAGE_KEY = "cookpato:data:v1";

function initialData(): AppData {
  return {
    version: 1,
    meals: {},
    stock: [],
    favorites: [],
  };
}

/** 安全に読み込む。必須フィールド欠落や型不整合は初期値に寄せる */
export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialData();
    const parsed = JSON.parse(raw) as unknown;
    if (!isBaseShape(parsed)) return initialData();
    const stock = parsed.stock.map(coerceStockItem).filter((s): s is StockItem => s !== null);
    const favorites = Array.isArray(parsed.favorites)
      ? parsed.favorites.filter((v): v is string => typeof v === "string")
      : [];
    const meals = coerceMeals(parsed.meals);
    return {
      version: 1,
      meals,
      stock,
      favorites,
    };
  } catch {
    return initialData();
  }
}

/** 安全に保存する（例外は握りつぶす） */
export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 書き込み失敗は許容（容量不足等）。次回入力で再試行される
  }
}

type BaseShape = { version: 1; meals: object; stock: unknown[]; favorites?: unknown };

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
            return { text: line.text, done: line.done === true };
          })
          .filter((x): x is { text: string; done: boolean } => x !== null)
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
