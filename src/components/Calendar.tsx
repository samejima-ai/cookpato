import { useEffect, useRef, useState } from "react";
import type { AppDataApi } from "../hooks/useAppData";
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

export function Calendar({ api, scrollTarget }: Props) {
  const today = todayKey();
  const [range, setRange] = useState(() => ({
    start: addDaysKey(today, -INITIAL_SPAN),
    end: addDaysKey(today, INITIAL_SPAN),
  }));

  const containerRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Map<DateKey, HTMLDivElement>>(new Map());
  const didInitialScroll = useRef(false);

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
            <div
              ref={(el) => {
                if (el) rowRefs.current.set(date, el);
                else rowRefs.current.delete(date);
              }}
            >
              <DayRow
                dateKey={date}
                day={api.data.meals[date]}
                isToday={date === today}
                onTextChange={(text) => api.setMealsText(date, text)}
                onToggleLine={(i) => api.toggleLine(date, i)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
