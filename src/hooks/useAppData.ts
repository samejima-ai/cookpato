/**
 * アプリ全体のデータを localStorage と同期するhook。
 * 1箇所に集約することで副作用をカプセル化する。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { CHEER_AUTO_LINE_COUNT, computeCheerDates, isEmptyDay } from "../lib/cheer";
import { startOfWeekKey, todayKey } from "../lib/date";
import { generateId } from "../lib/id";
import { favoriteKey } from "../lib/normalize";
import { loadData, saveData } from "../lib/storage";
import { isWeekComplete } from "../lib/week";
import type { AppData, DateKey, DayMeals, MealLine } from "../types";

/** 日付境界を検知するためのポーリング間隔（ms） */
const DAILY_TICK_MS = 60_000;

export type AppDataApi = {
  data: AppData;
  /** インポート（バックアップから復元）：AppData 全体を差し替える */
  restoreData: (data: AppData) => void;
  /** 1日分の献立テキストを更新（即時保存） */
  setMealsText: (date: DateKey, text: string) => void;
  /**
   * 指定された日付群のうち空日（isEmptyDay 真）に対してのみ、
   * 空 Line を count 個ぶら下げる。既存入力がある日はスキップ。
   * 起動時の自動行生成（シマエナガが発生する日に 4 行投入）に使う。
   * 冪等：既に count 個以上の空行を持つ日は no-op。
   */
  bulkAddEmptyLines: (dates: DateKey[], count: number) => void;
  /**
   * 指定日の lineIndex 行の text を更新する（フロート入力フォーム F011 から呼ぶ）。
   * テキスト変更時は done を false にリセット、cart を解除する（textToLines と同じ意味論）。
   * 同じ text なら no-op（識別子維持）。範囲外 index は no-op。
   * 全行 text=='' + memo なしになった場合は日付ごと削除する。
   */
  updateLineAt: (date: DateKey, lineIndex: number, text: string) => void;
  /** 1日分のちょいメモを更新（即時保存）。空文字は未設定扱い */
  setMemo: (date: DateKey, text: string) => void;
  /** 1日分の完了トグル（行インデックス単位） */
  toggleLine: (date: DateKey, lineIndex: number) => void;
  /** 指定行だけを削除（他の行の完了・お気に入りは保持） */
  deleteLine: (date: DateKey, lineIndex: number) => void;
  /**
   * 指定日の lineIndex の「上」または「下」に空行を 1 つ挿入する（F013 行間挿入）。
   * 挿入された空行の index を返す（呼び出し側が即フロート編集に渡す用）。
   * 範囲外 index は内部でクランプ（above=[0..length]、below=[0..length]）。
   * lines が無い日に呼ぶと先頭に 1 行生まれる（仕様：呼び出し側の前提を緩める）。
   */
  insertLineAt: (date: DateKey, lineIndex: number, where: "above" | "below") => number;
  /**
   * 2 日の lines + memo を入れ替える（F012 日付ごとスワップ）。
   * 双方向入れ替えのためデータ消失リスクなし。同日 / 両方空 / 範囲外は no-op。
   * スワップ後、両週を再評価し、新規達成週があれば completedWeeks に union し、
   * 移動元 dateA の週を優先して justCompletedSunday にセットする（F009「減らない」を維持）。
   */
  swapDays: (dateA: DateKey, dateB: DateKey) => void;
  /** お気に入りトグル。同じ料理（正規化テキスト一致）が別日にあれば共通でマーキングされる */
  toggleFavorite: (date: DateKey, lineIndex: number) => void;
  /** 買い物マーカーのトグル。行ごと（その日のその行のみ）に閉じる手動マーキング */
  toggleCart: (date: DateKey, lineIndex: number) => void;
  /** ストック追加。qty 省略時は 1 */
  addStock: (text: string, qty?: number) => void;
  /** ストックの qty を 1 増やす */
  incStock: (id: string) => void;
  /** ストックの qty を 1 減らす（0 でクランプ） */
  decStock: (id: string) => void;
  /** ストック削除（qty が 0 のときにユーザーが明示的に 0 ボタンを押したら呼ぶ） */
  removeStock: (id: string) => void;
  /** ストック項目の表示テキストを書き換える。空文字（trim 後）は no-op（既存テキスト維持） */
  updateStockText: (id: string, text: string) => void;
  /** ストック並び替え：fromIndex の項目を toIndex の位置に移動する。境界外は no-op */
  reorderStock: (fromIndex: number, toIndex: number) => void;
  /** 編集コミット時の「未達成 → 達成」遷移で日曜キーがセットされる演出トリガー。永続化しない */
  justCompletedSunday: DateKey | null;
  /** 「頑張ったね」演出の終了時に呼ぶ */
  clearJustCompleted: () => void;
  /** DayRow の編集モード進入時に呼ぶ。baseline スナップショットを取る（演出の正しい遷移判定用） */
  beginMealsEdit: (date: DateKey) => void;
  /** DayRow の textarea blur 時に呼ぶ。baseline と現在を比較して達成遷移を判定する */
  commitMealsEdit: (date: DateKey) => void;
};

/** 入力テキストを lines に変換（完了/買い物マーカーは同一テキストのみ維持、それ以外リセット） */
function textToLines(text: string, previous: DayMeals | undefined): DayMeals {
  const rawLines = text.split("\n");
  const prevLines = previous?.lines ?? [];
  const lines = rawLines.map((raw, i) => {
    const prev = prevLines[i];
    const sameText = prev && prev.text === raw;
    const done = sameText ? prev.done : false;
    const line: MealLine = { text: raw, done };
    // テキスト一致行のみ買い物マーカーを引き継ぐ（テキスト変更でリセットされる）
    if (sameText && prev.cart) line.cart = true;
    return line;
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
 * その日が「丸ごと空」か（lines も memo も実質的に未入力）。
 * F012 スワップの「両方空ならノーオペ」判定に使う。
 * 「空行」の意味論は他経路（`setMealsText` / `updateLineAt`）と揃えて
 * `text === "" && !done` を空とみなす（手動 toggleLine 等で発生し得る done=true な空行を排除）。
 */
function isCompletelyEmptyDay(day: DayMeals | undefined): boolean {
  if (!day) return true;
  if (day.memo && day.memo !== "") return false;
  if (day.lines.length === 0) return true;
  return day.lines.every((l) => l.text === "" && !l.done);
}

/**
 * 内部状態。data と演出トリガーをひとまとめにして、
 * 同一 tick 内で setMealsText が複数回呼ばれても直前の結果を連鎖して見られるようにする
 * （関数更新で必ず prev を経由するため）。
 */
type State = {
  data: AppData;
  justCompletedSunday: DateKey | null;
};

/** ストックを fromIndex から toIndex に並び替える。境界外なら変化なし */
function reorderStockArray(prev: State, fromIndex: number, toIndex: number): State {
  const stock = prev.data.stock;
  if (fromIndex < 0 || fromIndex >= stock.length) return prev;
  if (toIndex < 0 || toIndex >= stock.length) return prev;
  if (fromIndex === toIndex) return prev;
  const next = stock.slice();
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return prev;
  next.splice(toIndex, 0, moved);
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

  // 最新 state への ref（useCallback の dep を空に保ちつつ、callback 内で最新値を参照したい用）
  // insertLineAt の返り値計算で使う（setState updater の同期実行は保証されないため）
  const stateRef = useRef(state);
  stateRef.current = state;

  // 日付境界検知用の today。60s ポーリングで変化を拾い、自動生成 useEffect を再走させる。
  const [currentToday, setCurrentToday] = useState<DateKey>(() => todayKey());

  // data が変わるたびに保存
  useEffect(() => {
    saveData(state.data);
  }, [state.data]);

  // 日付境界の検知：60s 毎に今日キーを評価し、変化したら state を更新する。
  // 識別子が同じならクランプ（setState で prev 返却）して再レンダさせない。
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = todayKey();
      setCurrentToday((prev) => (prev === t ? prev : t));
    }, DAILY_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const restoreData = useCallback((data: AppData) => {
    setState((prev) => ({
      ...prev,
      data,
      justCompletedSunday: null,
    }));
  }, []);

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

  const bulkAddEmptyLines = useCallback((dates: DateKey[], count: number) => {
    if (count <= 0 || dates.length === 0) return;
    setState((prev) => {
      const nextMeals = { ...prev.data.meals };
      let mutated = false;
      for (const date of dates) {
        const day = nextMeals[date];
        if (!isEmptyDay(day)) continue;
        const before = day?.lines ?? [];
        // 既に count 個以上の空行があるなら no-op（冪等性ガード）
        if (before.length >= count && before.every((l) => l.text === "")) continue;
        const nextLines: MealLine[] = [];
        for (let i = 0; i < count; i++) {
          // 既存の空行があれば再利用（無駄な置換を避ける）
          nextLines.push(before[i] ?? { text: "", done: false });
        }
        const nextDay: DayMeals = { lines: nextLines };
        if (day?.memo) nextDay.memo = day.memo;
        nextMeals[date] = nextDay;
        mutated = true;
      }
      if (!mutated) return prev;
      return { ...prev, data: { ...prev.data, meals: nextMeals } };
    });
  }, []);

  const updateLineAt = useCallback((date: DateKey, lineIndex: number, text: string) => {
    setState((prev) => {
      const day = prev.data.meals[date];
      if (!day) return prev;
      if (lineIndex < 0 || lineIndex >= day.lines.length) return prev;
      const current = day.lines[lineIndex];
      if (!current || current.text === text) return prev;
      // textToLines と同意味論：テキスト変更時は done リセット、cart 解除
      const nextLines = day.lines.map((l, i) =>
        i === lineIndex ? ({ text, done: false } as MealLine) : l,
      );
      const isAllEmpty = nextLines.every((l) => l.text === "" && !l.done);
      const nextMeals = { ...prev.data.meals };
      if (isAllEmpty && !day.memo) {
        delete nextMeals[date];
      } else {
        const nextDay: DayMeals = { lines: nextLines };
        if (day.memo) nextDay.memo = day.memo;
        nextMeals[date] = nextDay;
      }
      return { ...prev, data: { ...prev.data, meals: nextMeals } };
    });
  }, []);

  // 起動時・日付変更時：今日〜today+6 の空日に CHEER_AUTO_LINE_COUNT 行を自動投入。
  // 冪等性ガードにより、既に投入済みの日は state 識別子が変わらず再走しない。
  useEffect(() => {
    const targets = computeCheerDates(state.data.meals, currentToday);
    if (targets.size === 0) return;
    bulkAddEmptyLines(Array.from(targets), CHEER_AUTO_LINE_COUNT);
  }, [state.data.meals, currentToday, bulkAddEmptyLines]);

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
    // ref 書き込みは StrictMode の updater 二重実行でも同値冪等なので updater 内で問題ない。
    setState((prev) => {
      editBaselineRef.current = prev.data.meals;
      return prev;
    });
  }, []);

  const commitMealsEdit = useCallback((date: DateKey) => {
    // StrictMode では setState の updater が dev 中 2 回実行される。
    // 以前は updater 内で editBaselineRef.current = null を行っていたが、
    // 2 回目の呼び出しで baseline が失われ判定が破綻していた。
    // クロージャに baseline を閉じ込めてから null 化し、updater を純粋に保つ。
    const baseline = editBaselineRef.current;
    editBaselineRef.current = null;
    setState((prev) => {
      const effectiveBaseline = baseline ?? prev.data.meals;
      const sunday = startOfWeekKey(date);
      // 既達成週は再発火させない（issue: 「同週を編集し直しても演出は出ない」）
      if (prev.data.completedWeeks.includes(sunday)) return prev;
      const wasComplete = isWeekComplete(effectiveBaseline, date);
      const nowComplete = isWeekComplete(prev.data.meals, date);
      if (wasComplete || !nowComplete) return prev;
      return {
        ...prev,
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

  // F013 行間挿入：指定行の「上」または「下」に空行を 1 つ挿入する。
  // 挿入された空行の最終 index を返す（呼び出し側が即フロート編集に渡す）。
  // setState updater の同期実行は React 18 でも保証されないため、index は updater 外で
  // ref 経由の最新 state から確定計算し、それを返す（updater 内でも同条件でクランプ）。
  const insertLineAt = useCallback(
    (date: DateKey, lineIndex: number, where: "above" | "below"): number => {
      const day = stateRef.current.data.meals[date];
      const before = day?.lines ?? [];
      // 範囲：above も below も 0..length にクランプする。
      // - above: lineIndex を [0, length] にクランプ
      // - below: lineIndex+1 を [0, length] にクランプ（負値の lineIndex も 0 に丸まる）
      // 仕様上は wobble メニュー経由でのみ呼ばれ既存行を対象とするが、念のためクランプする
      const insertIdx =
        where === "above"
          ? Math.max(0, Math.min(lineIndex, before.length))
          : Math.max(0, Math.min(lineIndex + 1, before.length));
      setState((prev) => {
        // updater 内は prev で再計算（バッチング時の整合性確保）。
        // 通常 stateRef.current と prev は同一だが、二重実行や差分があっても prev が真とする。
        const prevDay = prev.data.meals[date];
        const prevBefore = prevDay?.lines ?? [];
        const prevInsertIdx =
          where === "above"
            ? Math.max(0, Math.min(lineIndex, prevBefore.length))
            : Math.max(0, Math.min(lineIndex + 1, prevBefore.length));
        const nextLines: MealLine[] = [
          ...prevBefore.slice(0, prevInsertIdx),
          { text: "", done: false },
          ...prevBefore.slice(prevInsertIdx),
        ];
        const nextDay: DayMeals = { lines: nextLines };
        if (prevDay?.memo) nextDay.memo = prevDay.memo;
        return {
          ...prev,
          data: { ...prev.data, meals: { ...prev.data.meals, [date]: nextDay } },
        };
      });
      return insertIdx;
    },
    [],
  );

  // F012 日付ごとスワップ：dateA と dateB の lines + memo を入れ替える。
  // スワップ後、両週を再評価し、新規達成週があれば completedWeeks に union し
  // 移動元 dateA の週を優先して justCompletedSunday を立てる。
  // F009「献血カウントは減らない」を維持するため、未達成化する週があっても削除しない。
  const swapDays = useCallback((dateA: DateKey, dateB: DateKey) => {
    if (dateA === dateB) return;
    setState((prev) => {
      const dayA = prev.data.meals[dateA];
      const dayB = prev.data.meals[dateB];
      // 両方空ならノーオペ
      if (isCompletelyEmptyDay(dayA) && isCompletelyEmptyDay(dayB)) return prev;

      const nextMeals = { ...prev.data.meals };
      // 入れ替え：A の元値を B に、B の元値を A に。
      // 実質空（undefined / 全行 text='' かつ memo なし）なら日付ごと除外する
      // （他経路 setMealsText / updateLineAt / deleteLine と同一の正規化、空表現を一貫）
      const writeAt = (target: DateKey, sourceDay: DayMeals | undefined) => {
        if (isCompletelyEmptyDay(sourceDay)) {
          delete nextMeals[target];
          return;
        }
        // sourceDay は非 undefined（isCompletelyEmptyDay の早期 return で保証）
        // 受け取り側に DayMeals を新規生成し、lines 配列も slice で複製して書き込む。
        // 元配列の参照共有を避けることで、将来 lines を mutate する経路が出ても
        // スワップ元側に副作用が漏れないことを保証する（要素 MealLine は immutable 運用のため shallow で十分）。
        // biome-ignore lint/style/noNonNullAssertion: isCompletelyEmptyDay で undefined を排除済
        const src = sourceDay!;
        const next: DayMeals = { lines: src.lines.slice() };
        if (src.memo !== undefined) next.memo = src.memo;
        nextMeals[target] = next;
      };
      writeAt(dateA, dayB);
      writeAt(dateB, dayA);

      // 週達成の再評価（union のみ、減らさない）
      const sundayA = startOfWeekKey(dateA);
      const sundayB = startOfWeekKey(dateB);
      const completedSet = new Set(prev.data.completedWeeks);
      const newlyCompleted: DateKey[] = [];
      const evaluate = (sunday: DateKey) => {
        if (completedSet.has(sunday)) return;
        if (!isWeekComplete(nextMeals, sunday)) return;
        completedSet.add(sunday);
        newlyCompleted.push(sunday);
      };
      // 移動元 A の週を先に評価して splash の優先度を担保
      evaluate(sundayA);
      if (sundayB !== sundayA) evaluate(sundayB);

      const completedWeeks =
        newlyCompleted.length === 0
          ? prev.data.completedWeeks
          : [...prev.data.completedWeeks, ...newlyCompleted];
      const justCompletedSunday =
        newlyCompleted.length === 0 ? prev.justCompletedSunday : (newlyCompleted[0] ?? null);

      return {
        ...prev,
        data: { ...prev.data, meals: nextMeals, completedWeeks },
        justCompletedSunday,
      };
    });
  }, []);

  const toggleCart = useCallback((date: DateKey, lineIndex: number) => {
    setState((prev) => {
      const day = prev.data.meals[date];
      if (!day) return prev;
      const targetLine = day.lines[lineIndex];
      if (!targetLine || targetLine.text === "") return prev;
      const nextLines = day.lines.map((line, i) => {
        if (i !== lineIndex) return line;
        const next: MealLine = { text: line.text, done: line.done };
        // OFF→ON のときだけ cart を立てる。ON→OFF は未定義に戻して JSON 表現を最小化する
        if (!line.cart) next.cart = true;
        return next;
      });
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

  const updateStockText = useCallback((id: string, text: string) => {
    const trimmed = text.trim();
    if (trimmed === "") return;
    setState((prev) => {
      const target = prev.data.stock.find((s) => s.id === id);
      // id が無い／変更なしなら state を新規生成しない（保存・再レンダを発生させない）
      if (!target || target.text === trimmed) return prev;
      return {
        ...prev,
        data: {
          ...prev.data,
          stock: prev.data.stock.map((s) => (s.id === id ? { ...s, text: trimmed } : s)),
        },
      };
    });
  }, []);

  const reorderStock = useCallback((fromIndex: number, toIndex: number) => {
    setState((prev) => reorderStockArray(prev, fromIndex, toIndex));
  }, []);

  return {
    data: state.data,
    restoreData,
    setMealsText,
    bulkAddEmptyLines,
    updateLineAt,
    setMemo,
    toggleLine,
    deleteLine,
    insertLineAt,
    swapDays,
    toggleFavorite,
    toggleCart,
    addStock,
    incStock,
    decStock,
    removeStock,
    updateStockText,
    reorderStock,
    justCompletedSunday: state.justCompletedSunday,
    clearJustCompleted,
    beginMealsEdit,
    commitMealsEdit,
  };
}
