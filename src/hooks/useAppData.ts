/**
 * アプリ全体のデータを localStorage と同期するhook。
 * 1箇所に集約することで副作用をカプセル化する。
 */
import { useCallback, useEffect, useState } from "react";
import { generateId } from "../lib/id";
import { loadData, saveData } from "../lib/storage";
import type { AppData, DateKey, DayMeals } from "../types";

export type AppDataApi = {
  data: AppData;
  /** 1日分の献立テキストを更新（即時保存） */
  setMealsText: (date: DateKey, text: string) => void;
  /** 1日分の完了トグル（行インデックス単位） */
  toggleLine: (date: DateKey, lineIndex: number) => void;
  /** ストック追加 */
  addStock: (text: string) => void;
  /** ストック削除 */
  removeStock: (id: string) => void;
};

/** 入力テキストを lines に変換（空行は除外、行インデックスは残存行基準で振り直し） */
function textToLines(text: string, previous: DayMeals | undefined): DayMeals {
  const rawLines = text.split("\n");
  // 完了状態は「編集でリセットされても構わない」方針。
  // ただしUX上、行数や内容が変わらない場合は維持する（単純なトグル連打で失われないように）。
  const prevLines = previous?.lines ?? [];
  const lines = rawLines.map((raw, i) => {
    const prev = prevLines[i];
    // 行の内容が前回と同一なら完了状態を維持。それ以外はfalseにリセット。
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
      // 全行が空文字かつ完了状態も初期なら、meals から削除して肥大化防止
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

  const addStock = useCallback((text: string) => {
    const trimmed = text.trim();
    if (trimmed === "") return;
    setData((prev) => ({
      ...prev,
      stock: [...prev.stock, { id: generateId(), text: trimmed }],
    }));
  }, []);

  const removeStock = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      stock: prev.stock.filter((s) => s.id !== id),
    }));
  }, []);

  return { data, setMealsText, toggleLine, addStock, removeStock };
}
