import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import weekCompleteImg from "../assets/week-complete.png";
import weekMedalImg from "../assets/week-medal.png";
import type { AppDataApi } from "../hooks/useAppData";
import { computeCheerDates } from "../lib/cheer";
import { addDaysKey, formatMonthHeader, isFirstOfMonth, isSameMonth, todayKey } from "../lib/date";
import type { DateKey } from "../types";
import { DayRow } from "./DayRow";

type Props = {
  api: AppDataApi;
  /** スクロールすべき日付。変わるたびに中央に配置する */
  scrollTarget?: DateKey;
  /** 編集中 DayRow のカーソル行テキストとその日付を親に伝搬する */
  onActiveQueryChange?: (text: string, date: DateKey) => void;
};

/** 初期表示範囲：±60日 */
const INITIAL_SPAN = 60;
/** スクロール端に近づいたら展開する日数 */
const EXTEND_SPAN = 30;
const TRIGGER_PX = 800;

export function Calendar({ api, scrollTarget, onActiveQueryChange }: Props) {
  const today = todayKey();
  const [range, setRange] = useState(() => ({
    start: addDaysKey(today, -INITIAL_SPAN),
    end: addDaysKey(today, INITIAL_SPAN),
  }));

  const containerRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Map<DateKey, HTMLDivElement>>(new Map());
  const didInitialScroll = useRef(false);
  // sticky 月ヘッダーの高さは Tailwind の静的スタイルで決まるので、初回 1 度だけ
  // 計測してキャッシュする。スクロール毎に querySelector + offsetHeight を読むと
  // forced layout の原因になるため。
  const headerHeightRef = useRef(0);

  // 当日が画面外に出たことを示す状態。null の場合は画面内にいる
  const [todayOffscreen, setTodayOffscreen] = useState<"above" | "below" | null>(null);

  // sticky 月ヘッダーの高さを遅延初期化して返す（ref 参照なので依存なし）
  const getHeaderHeight = useCallback(() => {
    if (headerHeightRef.current > 0) return headerHeightRef.current;
    const sticky = containerRef.current?.querySelector<HTMLElement>(".sticky");
    headerHeightRef.current = sticky?.offsetHeight ?? 0;
    return headerHeightRef.current;
  }, []);

  // 今日を含む 7 日の空日に応援イラストを出す（SPEC「空状態の応援表示」）
  const cheerDates = useMemo(
    () => computeCheerDates(api.data.meals, today),
    [api.data.meals, today],
  );

  // お気に入りは正規化テキスト集合として保持されているので Set に変換して渡す
  const favoriteKeys = useMemo(() => new Set(api.data.favorites), [api.data.favorites]);

  // 「頑張ったね」演出：justCompletedSunday がセットされたら 3 秒後に自動クリア
  useEffect(() => {
    if (!api.justCompletedSunday) return;
    const timer = window.setTimeout(() => {
      api.clearJustCompleted();
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [api.justCompletedSunday, api.clearJustCompleted]);

  // 当日を画面上部（sticky 月ヘッダーの直下）にスクロール
  const scrollToToday = useCallback(
    (behavior: ScrollBehavior) => {
      const todayRow = rowRefs.current.get(today);
      const container = containerRef.current;
      if (!todayRow || !container) return;
      container.scrollTo({ top: todayRow.offsetTop - getHeaderHeight(), behavior });
    },
    [today, getHeaderHeight],
  );

  // 初期スクロール：当日を画面上部へ
  useEffect(() => {
    if (didInitialScroll.current) return;
    if (rowRefs.current.has(today) && containerRef.current) {
      scrollToToday("auto");
      didInitialScroll.current = true;
    }
  }, [today, scrollToToday]);

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

  // 端スクロール検知して範囲を広げる + 当日が画面外かを追跡
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

    // 当日行と viewport を比較して、ボタン表示を更新。
    // sticky 月ヘッダーで上部が隠れた状態を「画面外（above）」として扱うため、
    // ヘッダー高さ分だけ viewTop を下にずらす。
    const todayRow = rowRefs.current.get(today);
    if (!todayRow) return;
    const rowTop = todayRow.offsetTop;
    const rowBottom = rowTop + todayRow.offsetHeight;
    const viewTop = scrollTop + getHeaderHeight();
    const viewBottom = scrollTop + clientHeight;
    if (rowBottom <= viewTop) {
      setTodayOffscreen("above");
    } else if (rowTop >= viewBottom) {
      setTodayOffscreen("below");
    } else {
      setTodayOffscreen(null);
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
    <div className="flex-1 relative overflow-hidden bg-white">
      <div ref={containerRef} onScroll={handleScroll} className="h-full overflow-y-auto">
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
                  showCheer={cheerDates.has(date)}
                  favoriteKeys={favoriteKeys}
                  onTextChange={(text) => api.setMealsText(date, text)}
                  onToggleLine={(i) => api.toggleLine(date, i)}
                  onToggleFavorite={(i) => api.toggleFavorite(date, i)}
                  onDeleteLine={(i) => api.deleteLine(date, i)}
                  onMemoChange={(text) => api.setMemo(date, text)}
                  onActiveQueryChange={onActiveQueryChange}
                  onBeginEdit={api.beginMealsEdit}
                  onCommitEdit={api.commitMealsEdit}
                />
              </div>
            </div>
          );
        })}
      </div>
      {api.justCompletedSunday && (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-week-complete"
          aria-live="polite"
          aria-label="今週の献立が埋まりました"
        >
          <img
            src={weekCompleteImg}
            alt=""
            aria-hidden="true"
            className="w-screen max-w-xl h-auto drop-shadow"
          />
        </div>
      )}
      {todayOffscreen && (
        <button
          type="button"
          onClick={() => scrollToToday("smooth")}
          aria-label="今日にスクロール"
          className="absolute bottom-3 right-3 h-11 px-4 rounded-full bg-white/95 shadow-md border border-neutral-200 text-sm font-medium text-neutral-700 flex items-center gap-1 active:bg-neutral-100"
        >
          <span aria-hidden="true">{todayOffscreen === "above" ? "↑" : "↓"}</span>
          <span>今日</span>
        </button>
      )}
      {api.data.completedWeeks.length > 0 && (
        <div
          className="pointer-events-none absolute bottom-3 left-3 h-11 pl-1 pr-3 rounded-full bg-white/95 shadow-md border border-neutral-200 flex items-center gap-1"
          aria-label={`達成週 ${api.data.completedWeeks.length} 回`}
        >
          <img src={weekMedalImg} alt="" aria-hidden="true" className="w-8 h-8 shrink-0" />
          <span className="text-sm font-medium text-neutral-700 tabular-nums">
            × {api.data.completedWeeks.length}
          </span>
        </div>
      )}
    </div>
  );
}
