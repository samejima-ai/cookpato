/**
 * アプリ全体のデータを localStorage と同期するhook。
 * 1箇所に集約することで副作用をカプセル化する。
 */
import { useCallback, useEffect, useState } from "react";
import { generateId } from "../lib/id";
import { normalize } from "../lib/normalize";
import { loadData, saveData } from "../lib/storage";
import type { AppData, DateKey, DayMeals } from "../types";

export type AppDataApi = {
  data: AppData;
  /** 1日分の献立テキストを更新（即時保存） */
  setMealsText: (date: DateKey, text: string) => void;
  /** 1日分の完了トグル（行インデックス単位） */
  toggleLine: (date: DateKey, lineIndex: number) => void;
  /** お気に入りトグル。同じ料理（正規化テキスト一致）が別日にあれば共通でマーキングされる */
  toggleFavorite: (date: DateKey, lineIndex: number) => void;
  /** ストック追加。qty 省略時は 1 */
  addStock: (text: string, qty?: number) => void;
  /** ストックの qty を 1 増やす */
  incStock: (id: string) => void;
  /** ストックの qty を 1 減らす（0 でクランプ） */
  decStock: (id: string) => void;
  /** ストック削除（qty が 0 のときにユーザーが明示的に 0 ボタンを押したら呼ぶ） */
  removeStock: (id: string) => void;
};

/** 入力テキストを lines に変換（完了状態は同一テキストのみ維持、それ以外リセット） */
function textToLines(text: string, previous: DayMeals | undefined): DayMeals {
  const rawLines = text.split("\n");
  const prevLines = previous?.lines ?? [];
  const lines = rawLines.map((raw, i) => {
    const prev = prevLines[i];
    const done = prev && prev.text === raw ? prev.done : false;
    return { text: raw, done };
  });
  return { lines };
}

export function useAppData(): AppDataApi {
  const [data, setData] = useState<AppData>(() => loadData());

  // data が変わるたびに保存
  useEffect(() => {
    saveData(data);
  }, [data]);

  const setMealsText = useCallback((date: DateKey, text: string) => {
    setData((prev) => {
      const nextDay = textToLines(text, prev.meals[date]);
      // 全行が空文字かつ完了もなければ meals から削除して肥大化防止
      const isEmpty = nextDay.lines.every((l) => l.text === "" && !l.done);
      const nextMeals = { ...prev.meals };
      if (isEmpty) {
        delete nextMeals[date];
      } else {
        nextMeals[date] = nextDay;
      }
      return { ...prev, meals: nextMeals };
    });
  }, []);

  const toggleLine = useCallback((date: DateKey, lineIndex: number) => {
    setData((prev) => {
      const day = prev.meals[date];
      if (!day) return prev;
      const targetLine = day.lines[lineIndex];
      if (!targetLine) return prev;
      const nextLines = day.lines.map((line, i) =>
        i === lineIndex ? { ...line, done: !line.done } : line,
      );
      return {
        ...prev,
        meals: { ...prev.meals, [date]: { lines: nextLines } },
      };
    });
  }, []);

  const toggleFavorite = useCallback((date: DateKey, lineIndex: number) => {
    setData((prev) => {
      const day = prev.meals[date];
      if (!day) return prev;
      const line = day.lines[lineIndex];
      if (!line || line.text === "") return prev;
      const key = normalize(line.text);
      if (key === "") return prev;
      const already = prev.favorites.includes(key);
      const favorites = already
        ? prev.favorites.filter((k) => k !== key)
        : [...prev.favorites, key];
      return { ...prev, favorites };
    });
  }, []);

  const addStock = useCallback((text: string, qty = 1) => {
    const trimmed = text.trim();
    if (trimmed === "") return;
    const safeQty = Number.isFinite(qty) ? Math.max(1, Math.floor(qty)) : 1;
    setData((prev) => ({
      ...prev,
      stock: [...prev.stock, { id: generateId(), text: trimmed, qty: safeQty }],
    }));
  }, []);

  const incStock = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      stock: prev.stock.map((s) => (s.id === id ? { ...s, qty: s.qty + 1 } : s)),
    }));
  }, []);

  const decStock = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      stock: prev.stock.map((s) => (s.id === id ? { ...s, qty: Math.max(0, s.qty - 1) } : s)),
    }));
  }, []);

  const removeStock = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      stock: prev.stock.filter((s) => s.id !== id),
    }));
  }, []);

  return {
    data,
    setMealsText,
    toggleLine,
    toggleFavorite,
    addStock,
    incStock,
    decStock,
    removeStock,
  };
}
