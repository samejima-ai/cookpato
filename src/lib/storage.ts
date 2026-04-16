/**
 * localStorage ラッパー。単一キー "cookpato:data:v1" に AppData を JSON で保存。
 * 読み書きエラーは黙って初期値を返す（単一ユーザー・シンプル運用のため）。
 */
import type { AppData } from "../types";

const STORAGE_KEY = "cookpato:data:v1";

function initialData(): AppData {
  return {
    version: 1,
    meals: {},
    stock: [],
  };
}

/** 安全に読み込む */
export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialData();
    const parsed = JSON.parse(raw) as unknown;
    if (!isAppData(parsed)) return initialData();
    return parsed;
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

function isAppData(v: unknown): v is AppData {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    o.version === 1 && typeof o.meals === "object" && o.meals !== null && Array.isArray(o.stock)
  );
}
