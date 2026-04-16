import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppDataApi } from "../hooks/useAppData";
import { computeCheerDates } from "../lib/cheer";
import { addDaysKey, formatMonthHeader, isFirstOfMonth, isSameMonth, todayKey } from "../lib/date";
import type { DateKey } from "../types";
import { DayRow } from "./DayRow";

type Props = {
  api: AppDataApi;
  /** スクロールすべき日付。変わるたびに中央に配置する */
  scrollTarget?: DateKey;
};

/** 初期表示範囲：±60日 */
const INITIAL_SPAN = 60;
/** スクロール端に近づいたら展開する日数 */
const EXTEND_SPAN = 30;
const TRIGGER_PX = 800;
/**
 * 「常時 textarea」とする可視範囲のバッファ（前後日数）。
 * SPEC「フリー入力 / 編集モードの扱い」：viewport ± 数日〜10日程度。
 * 初期値は ±7 日（= 約 1 週間。妻の週単位入力ユースケースに合わせる）。
 */
const EDIT_BUFFER_DAYS = 7;

export function Calendar({ api, scrollTarget }: Props) {
  const today = todayKey();
  const [range, setRange] = useState(() => ({
    start: addDaysKey(today, -INITIAL_SPAN),
    end: addDaysKey(today, INITIAL_SPAN),
  }));

  const containerRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Map<DateKey, HTMLDivElement>>(new Map());
  const didInitialScroll = useRef(false);

  // 未来の空日に応援イラストを出す対象日集合（SPEC「空状態の応援表示」）
  const cheerDates = useMemo(
    () => computeCheerDates(api.data.meals, today, INITIAL_SPAN),
    [api.data.meals, today],
  );

  // 「常時 textarea 化」する日付集合（可視 + バッファ）
  // 初期値：当日を中央に置くので today ± EDIT_BUFFER_DAYS を入れておく
  const [editableDates, setEditableDates] = useState<Set<DateKey>>(() => {
    const set = new Set<DateKey>();
    for (let i = -EDIT_BUFFER_DAYS; i <= EDIT_BUFFER_DAYS; i++) {
      set.add(addDaysKey(today, i));
    }
    return set;
  });

  // IntersectionObserver で可視 DayRow を検出
  const visibleDatesRef = useRef<Set<DateKey>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);

  const recomputeEditable = useCallback(() => {
    const next = new Set<DateKey>();
    // 初期表示の安定性のため、当日付近は常に含める（IntersectionObserver の確定前にも編集可能）
    for (let i = -EDIT_BUFFER_DAYS; i <= EDIT_BUFFER_DAYS; i++) {
      next.add(addDaysKey(today, i));
    }
    for (const d of visibleDatesRef.current) {
      for (let i = -EDIT_BUFFER_DAYS; i <= EDIT_BUFFER_DAYS; i++) {
        next.add(addDaysKey(d, i));
      }
    }
    setEditableDates((prev) => (areSetsEqual(prev, next) ? prev : next));
  }, [today]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let changed = false;
        for (const entry of entries) {
          const date = (entry.target as HTMLElement).dataset.date;
          if (!date) continue;
          if (entry.isIntersecting) {
            if (!visibleDatesRef.current.has(date)) {
              visibleDatesRef.current.add(date);
              changed = true;
            }
          } else if (visibleDatesRef.current.has(date)) {
            visibleDatesRef.current.delete(date);
            changed = true;
          }
        }
        if (changed) recomputeEditable();
      },
      { root: container, rootMargin: "0px", threshold: 0.01 },
    );
    observerRef.current = observer;
    // 既にマウント済みの行を監視対象に追加
    for (const el of rowRefs.current.values()) {
      observer.observe(el);
    }
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [recomputeEditable]);

  // 初期スクロール：当日を画面中央へ
  useEffect(() => {
    if (didInitialScroll.current) return;
    const todayRow = rowRefs.current.get(today);
    const container = containerRef.current;
    if (todayRow && container) {
      const rowTop = todayRow.offsetTop;
      const rowHeight = todayRow.offsetHeight;
      container.scrollTop = rowTop - container.clientHeight / 2 + rowHeight / 2;
      didInitialScroll.current = true;
    }
  }, [today]);

  // scrollTarget への移動
  useEffect(() => {
    if (!scrollTarget) return;
    const row = rowRefs.current.get(scrollTarget);
    const container = containerRef.current;
    if (!row || !container) {
      // 範囲外なら範囲を広げる
      setRange((prev) => ({
        start: scrollTarget < prev.start ? scrollTarget : prev.start,
        end: scrollTarget > prev.end ? scrollTarget : prev.end,
      }));
      return;
    }
    const rowTop = row.offsetTop;
    const rowHeight = row.offsetHeight;
    container.scrollTo({
      top: rowTop - container.clientHeight / 2 + rowHeight / 2,
      behavior: "smooth",
    });
  }, [scrollTarget]);

  // 端スクロール検知して範囲を広げる
  function handleScroll() {
    const container = containerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollTop < TRIGGER_PX) {
      setRange((prev) => ({
        start: addDaysKey(prev.start, -EXTEND_SPAN),
        end: prev.end,
      }));
    } else if (scrollHeight - scrollTop - clientHeight < TRIGGER_PX) {
      setRange((prev) => ({
        start: prev.start,
        end: addDaysKey(prev.end, EXTEND_SPAN),
      }));
    }
  }

  // 範囲から日付列を作る
  const dates: DateKey[] = [];
  {
    let cursor = range.start;
    // ループ上限：念のため
    let guard = 0;
    while (cursor <= range.end && guard < 10000) {
      dates.push(cursor);
      cursor = addDaysKey(cursor, 1);
      guard++;
    }
  }

  // 範囲拡張で上方向に広げた場合、スクロール位置を維持する（ジャンプ防止）
  const prevStartRef = useRef(range.start);
  const prevScrollHeightRef = useRef(0);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (range.start < prevStartRef.current) {
      const delta = container.scrollHeight - prevScrollHeightRef.current;
      container.scrollTop += delta;
    }
    prevStartRef.current = range.start;
    prevScrollHeightRef.current = container.scrollHeight;
  }, [range.start]);

  // 各日付行の ref コールバックを安定化するキャッシュ。
  // 無名関数をインラインで渡すと毎レンダー新規参照になり、React が旧ref→null→
  // 新ref→element の形で ref を張り直す。その結果 IntersectionObserver の
  // observe/unobserve がチャーンして、alwaysEditable 判定の揺れ（モードフラップ）や
  // 入力中のパフォーマンス劣化を招くため、日付単位で関数をメモ化する。
  const rowRefCallbacks = useRef<Map<DateKey, (el: HTMLDivElement | null) => void>>(new Map());
  const getRowRefCallback = useCallback((date: DateKey) => {
    const cached = rowRefCallbacks.current.get(date);
    if (cached) return cached;
    const cb = (el: HTMLDivElement | null) => {
      if (el) {
        el.dataset.date = date;
        rowRefs.current.set(date, el);
        observerRef.current?.observe(el);
      } else {
        const prev = rowRefs.current.get(date);
        if (prev) observerRef.current?.unobserve(prev);
        rowRefs.current.delete(date);
        visibleDatesRef.current.delete(date);
      }
    };
    rowRefCallbacks.current.set(date, cb);
    return cb;
  }, []);

  return (
    <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto bg-white">
      {dates.map((date) => {
        const showHeader = isFirstOfMonth(date) || date === dates[0];
        const headerVisible =
          showHeader || !isSameMonth(date, dates[dates.indexOf(date) - 1] ?? "");
        return (
          <div key={date}>
            {headerVisible && (
              <div className="sticky top-0 z-10 bg-neutral-50 border-y border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-600">
                {formatMonthHeader(date)}
              </div>
            )}
            <div data-date={date} ref={getRowRefCallback(date)}>
              <DayRow
                dateKey={date}
                day={api.data.meals[date]}
                isToday={date === today}
                showCheer={cheerDates.has(date)}
                alwaysEditable={editableDates.has(date)}
                onTextChange={(text) => api.setMealsText(date, text)}
                onToggleLine={(i) => api.toggleLine(date, i)}
                onToggleFavorite={(i) => api.toggleFavorite(date, i)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Set の浅い等価判定（再レンダ抑止用） */
function areSetsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}
