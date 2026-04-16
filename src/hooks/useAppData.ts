/**
 * アプリ全体のデータを localStorage と同期するhook。
 * 1箇所に集約することで副作用をカプセル化する。
 */
import { useCallback, useEffect, useState } from "react";
import { startOfWeekKey } from "../lib/date";
import { generateId } from "../lib/id";
import { favoriteKey } from "../lib/normalize";
import { loadData, saveData } from "../lib/storage";
import { isWeekComplete } from "../lib/week";
import type { AppData, DateKey, DayMeals } from "../types";

export type AppDataApi = {
  data: AppData;
  /** 1日分の献立テキストを更新（即時保存） */
  setMealsText: (date: DateKey, text: string) => void;
  /** 1日分の完了トグル（行インデックス単位） */
  toggleLine: (date: DateKey, lineIndex: number) => void;
  /** 指定行だけを削除（他の行の完了・お気に入りは保持） */
  deleteLine: (date: DateKey, lineIndex: number) => void;
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
  /** 直前の setMealsText で週が満タンになった瞬間の日曜 DateKey（演出トリガー用）。永続化しない */
  justCompletedSunday: DateKey | null;
  /** 「頑張ったね」演出の終了時に呼ぶ */
  clearJustCompleted: () => void;
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

/**
 * 内部状態。data と演出トリガーをひとまとめにして、
 * 同一 tick 内で setMealsText が複数回呼ばれても直前の結果を連鎖して見られるようにする
 * （関数更新で必ず prev を経由するため）。
 */
type State = { data: AppData; justCompletedSunday: DateKey | null };

export function useAppData(): AppDataApi {
  const [state, setState] = useState<State>(() => ({
    data: loadData(),
    justCompletedSunday: null,
  }));

  // data が変わるたびに保存
  useEffect(() => {
    saveData(state.data);
  }, [state.data]);

  const setMealsText = useCallback((date: DateKey, text: string) => {
    setState((prev) => {
      const nextDay = textToLines(text, prev.data.meals[date]);
      const isEmpty = nextDay.lines.every((l) => l.text === "" && !l.done);
      const nextMeals = { ...prev.data.meals };
      if (isEmpty) {
        delete nextMeals[date];
      } else {
        nextMeals[date] = nextDay;
      }
      // 週の「未達成 → 達成」遷移を検知して演出トリガーを立てる
      const wasComplete = isWeekComplete(prev.data.meals, date);
      const nowComplete = isWeekComplete(nextMeals, date);
      const justCompletedSunday =
        !wasComplete && nowComplete ? startOfWeekKey(date) : prev.justCompletedSunday;
      return {
        data: { ...prev.data, meals: nextMeals },
        justCompletedSunday,
      };
    });
  }, []);

  const clearJustCompleted = useCallback(() => {
    setState((prev) =>
      prev.justCompletedSunday === null ? prev : { ...prev, justCompletedSunday: null },
    );
  }, []);

  const toggleLine = useCallback((date: DateKey, lineIndex: number) => {
    setState((prev) => {
      const day = prev.data.meals[date];
      if (!day) return prev;
      const targetLine = day.lines[lineIndex];
      if (!targetLine) return prev;
      const nextLines = day.lines.map((line, i) =>
        i === lineIndex ? { ...line, done: !line.done } : line,
      );
      return {
        ...prev,
        data: {
          ...prev.data,
          meals: { ...prev.data.meals, [date]: { lines: nextLines } },
        },
      };
    });
  }, []);

  const deleteLine = useCallback((date: DateKey, lineIndex: number) => {
    setState((prev) => {
      const day = prev.data.meals[date];
      if (!day) return prev;
      if (lineIndex < 0 || lineIndex >= day.lines.length) return prev;
      const nextLines = day.lines.filter((_, i) => i !== lineIndex);
      const nextMeals = { ...prev.data.meals };
      const nothingLeft =
        nextLines.length === 0 || (nextLines.length === 1 && nextLines[0]?.text === "");
      if (nothingLeft) {
        delete nextMeals[date];
      } else {
        nextMeals[date] = { lines: nextLines };
      }
      return { ...prev, data: { ...prev.data, meals: nextMeals } };
    });
  }, []);

  const toggleFavorite = useCallback((date: DateKey, lineIndex: number) => {
    setState((prev) => {
      const day = prev.data.meals[date];
      if (!day) return prev;
      const line = day.lines[lineIndex];
      if (!line || line.text === "") return prev;
      const key = favoriteKey(line.text);
      if (key === "") return prev;
      const already = prev.data.favorites.includes(key);
      const favorites = already
        ? prev.data.favorites.filter((k) => k !== key)
        : [...prev.data.favorites, key];
      return { ...prev, data: { ...prev.data, favorites } };
    });
  }, []);

  const addStock = useCallback((text: string, qty = 1) => {
    const trimmed = text.trim();
    if (trimmed === "") return;
    const safeQty = Number.isFinite(qty) ? Math.max(1, Math.floor(qty)) : 1;
    setState((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        stock: [...prev.data.stock, { id: generateId(), text: trimmed, qty: safeQty }],
      },
    }));
  }, []);

  const incStock = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        stock: prev.data.stock.map((s) => (s.id === id ? { ...s, qty: s.qty + 1 } : s)),
      },
    }));
  }, []);

  const decStock = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        stock: prev.data.stock.map((s) =>
          s.id === id ? { ...s, qty: Math.max(0, s.qty - 1) } : s,
        ),
      },
    }));
  }, []);

  const removeStock = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      data: { ...prev.data, stock: prev.data.stock.filter((s) => s.id !== id) },
    }));
  }, []);

  return {
    data: state.data,
    setMealsText,
    toggleLine,
    deleteLine,
    toggleFavorite,
    addStock,
    incStock,
    decStock,
    removeStock,
    justCompletedSunday: state.justCompletedSunday,
    clearJustCompleted,
  };
}
