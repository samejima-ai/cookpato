/**
 * アプリ全体のデータを localStorage と同期するhook。
 * 1箇所に集約することで副作用をカプセル化する。
 */
import { useCallback, useEffect, useRef, useState } from "react";
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
  /** 1日分のちょいメモを更新（即時保存）。空文字は未設定扱い */
  setMemo: (date: DateKey, text: string) => void;
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
  /** ストック項目を 1 つ上に移動（先頭は no-op） */
  moveStockUp: (id: string) => void;
  /** ストック項目を 1 つ下に移動（末尾は no-op） */
  moveStockDown: (id: string) => void;
  /** 編集コミット時の「未達成 → 達成」遷移で日曜キーがセットされる演出トリガー。永続化しない */
  justCompletedSunday: DateKey | null;
  /** 「頑張ったね」演出の終了時に呼ぶ */
  clearJustCompleted: () => void;
  /** DayRow の編集モード進入時に呼ぶ。baseline スナップショットを取る（演出の正しい遷移判定用） */
  beginMealsEdit: (date: DateKey) => void;
  /** DayRow の textarea blur 時に呼ぶ。baseline と現在を比較して達成遷移を判定する */
  commitMealsEdit: (date: DateKey) => void;
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
  const next: DayMeals = { lines };
  if (previous?.memo) next.memo = previous.memo;
  return next;
}

/** lines が実質空（長さ 0 か、1 行だけで空文字）か */
function linesAreEmpty(lines: DayMeals["lines"]): boolean {
  if (lines.length === 0) return true;
  if (lines.length === 1 && lines[0]?.text === "") return true;
  return false;
}

/**
 * 内部状態。data と演出トリガーをひとまとめにして、
 * 同一 tick 内で setMealsText が複数回呼ばれても直前の結果を連鎖して見られるようにする
 * （関数更新で必ず prev を経由するため）。
 */
type State = { data: AppData; justCompletedSunday: DateKey | null };

/** ストックの指定 id を delta 分（-1 で上、+1 で下）入れ替える。端では変化なし */
function swapStock(prev: State, id: string, delta: -1 | 1): State {
  const stock = prev.data.stock;
  const idx = stock.findIndex((s) => s.id === id);
  if (idx === -1) return prev;
  const target = idx + delta;
  if (target < 0 || target >= stock.length) return prev;
  const next = stock.slice();
  const a = next[idx];
  const b = next[target];
  if (!a || !b) return prev;
  next[idx] = b;
  next[target] = a;
  return { ...prev, data: { ...prev.data, stock: next } };
}

export function useAppData(): AppDataApi {
  const [state, setState] = useState<State>(() => ({
    data: loadData(),
    justCompletedSunday: null,
  }));

  // 編集セッション開始時の meals スナップショット参照。
  // beginMealsEdit で保存し、commitMealsEdit で「未達成 → 達成」遷移判定に使う。
  // copy-on-write な状態なので参照保持で十分（深いコピー不要）。
  const editBaselineRef = useRef<Record<DateKey, DayMeals> | null>(null);

  // data が変わるたびに保存
  useEffect(() => {
    saveData(state.data);
  }, [state.data]);

  const setMealsText = useCallback((date: DateKey, text: string) => {
    setState((prev) => {
      const nextDay = textToLines(text, prev.data.meals[date]);
      const isEmpty = nextDay.lines.every((l) => l.text === "" && !l.done);
      const nextMeals = { ...prev.data.meals };
      // lines が空でも memo があれば日付は残す
      if (isEmpty && !nextDay.memo) {
        delete nextMeals[date];
      } else {
        nextMeals[date] = nextDay;
      }
      // 演出トリガー（justCompletedSunday）と completedWeeks の更新は
      // commitMealsEdit（textarea blur 時）で行う。
      // ここでキーストローク毎に評価すると 1 文字入力で発火してしまうため。
      return {
        ...prev,
        data: { ...prev.data, meals: nextMeals },
      };
    });
  }, []);

  const setMemo = useCallback((date: DateKey, text: string) => {
    const trimmed = text;
    setState((prev) => {
      const current = prev.data.meals[date];
      const lines = current?.lines ?? [];
      const hasMemo = trimmed !== "";
      const nextMeals = { ...prev.data.meals };
      if (!hasMemo && linesAreEmpty(lines)) {
        // メモも lines も空なら日付ごと除外
        delete nextMeals[date];
      } else {
        const nextDay: DayMeals = { lines };
        if (hasMemo) nextDay.memo = trimmed;
        nextMeals[date] = nextDay;
      }
      return { ...prev, data: { ...prev.data, meals: nextMeals } };
    });
  }, []);

  const clearJustCompleted = useCallback(() => {
    setState((prev) =>
      prev.justCompletedSunday === null ? prev : { ...prev, justCompletedSunday: null },
    );
  }, []);

  const beginMealsEdit = useCallback((_date: DateKey) => {
    // 関数更新で必ず最新 state を経由してスナップショットを取る。
    // 状態は更新しない（identity 維持で再レンダ抑止）。
    setState((prev) => {
      editBaselineRef.current = prev.data.meals;
      return prev;
    });
  }, []);

  const commitMealsEdit = useCallback((date: DateKey) => {
    setState((prev) => {
      const baseline = editBaselineRef.current ?? prev.data.meals;
      editBaselineRef.current = null;
      const sunday = startOfWeekKey(date);
      // 既達成週は再発火させない（issue: 「同週を編集し直しても演出は出ない」）
      if (prev.data.completedWeeks.includes(sunday)) return prev;
      const wasComplete = isWeekComplete(baseline, date);
      const nowComplete = isWeekComplete(prev.data.meals, date);
      if (wasComplete || !nowComplete) return prev;
      return {
        data: {
          ...prev.data,
          completedWeeks: [...prev.data.completedWeeks, sunday],
        },
        justCompletedSunday: sunday,
      };
    });
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
      const nextDay: DayMeals = { lines: nextLines };
      if (day.memo) nextDay.memo = day.memo;
      return {
        ...prev,
        data: {
          ...prev.data,
          meals: { ...prev.data.meals, [date]: nextDay },
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
      const nothingLeft = linesAreEmpty(nextLines);
      // lines が空でも memo があれば日付は残す
      if (nothingLeft && !day.memo) {
        delete nextMeals[date];
      } else {
        const nextDay: DayMeals = { lines: nextLines };
        if (day.memo) nextDay.memo = day.memo;
        nextMeals[date] = nextDay;
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

  const moveStockUp = useCallback((id: string) => {
    setState((prev) => swapStock(prev, id, -1));
  }, []);

  const moveStockDown = useCallback((id: string) => {
    setState((prev) => swapStock(prev, id, 1));
  }, []);

  return {
    data: state.data,
    setMealsText,
    setMemo,
    toggleLine,
    deleteLine,
    toggleFavorite,
    addStock,
    incStock,
    decStock,
    removeStock,
    moveStockUp,
    moveStockDown,
    justCompletedSunday: state.justCompletedSunday,
    clearJustCompleted,
    beginMealsEdit,
    commitMealsEdit,
  };
}
