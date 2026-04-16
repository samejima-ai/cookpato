/**
 * localStorage ラッパー。単一キー "cookpato:data:v1" に AppData を JSON で保存。
 * 読み書きエラーは黙って初期値を返す（単一ユーザー・シンプル運用のため）。
 */
import type { AppData, StockItem } from "../types";

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
    return {
      version: 1,
      meals: parsed.meals as AppData["meals"],
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

function coerceStockItem(raw: unknown): StockItem | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.text !== "string") return null;
  const qty =
    typeof o.qty === "number" && Number.isFinite(o.qty) ? Math.max(0, Math.floor(o.qty)) : 1;
  return { id: o.id, text: o.text, qty };
}
