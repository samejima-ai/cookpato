import { useEffect, useState } from "react";
import { Calendar } from "./components/Calendar";
import { SearchBar } from "./components/SearchBar";
import { SearchResults } from "./components/SearchResults";
import { StockList } from "./components/StockList";
import { useAppData } from "./hooks/useAppData";
import { useSearch } from "./hooks/useSearch";
import type { DateKey } from "./types";

/** アクティブ行の類似検索で遡る期間（軽量動作のため過去1年に制限） */
const ACTIVE_SEARCH_SINCE_DAYS = 365;
/** 件数バッジの上限。これ以上は「20+」表記にする */
const ACTIVE_COUNT_CAP = 20;
/** アクティブ行の入力に対する件数計算のデバウンス（ms） */
const ACTIVE_DEBOUNCE_MS = 150;

export default function App() {
  const api = useAppData();
  const [query, setQuery] = useState("");
  const [scrollTarget, setScrollTarget] = useState<DateKey | undefined>(undefined);
  const [activeQuery, setActiveQuery] = useState("");
  const [debouncedActiveQuery, setDebouncedActiveQuery] = useState("");
  const hits = useSearch(api.data, query);

  // 150ms のデバウンスで件数計算（キーストロークごとの全走査を抑える）
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedActiveQuery(activeQuery), ACTIVE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [activeQuery]);

  // 検索欄に入力中はバッジを出さない（結果パネルと重複するため）
  const activeHits = useSearch(api.data, query.trim() === "" ? debouncedActiveQuery : "", {
    sinceDays: ACTIVE_SEARCH_SINCE_DAYS,
    // 「20+」判定用に 1 件余分に取る
    maxResults: ACTIVE_COUNT_CAP + 1,
  });
  const activeCount = activeHits.length;

  function handlePickResult(date: DateKey) {
    setScrollTarget(date);
    setQuery("");
    // 同じ日付が連続選択された場合も再スクロールできるよう、次フレームで未定義化
    requestAnimationFrame(() => setScrollTarget(undefined));
  }

  function handleActiveCountTap() {
    // バッジタップで検索欄にクエリを流し込み、既存の結果パネルを開く
    setQuery(debouncedActiveQuery);
  }

  return (
    <div className="flex flex-col h-full max-w-xl mx-auto">
      <header className="relative shrink-0 safe-top">
        <SearchBar
          value={query}
          onChange={setQuery}
          activeCount={activeCount}
          activeCountCap={ACTIVE_COUNT_CAP}
          onActiveCountTap={handleActiveCountTap}
        />
        <SearchResults hits={hits} query={query} onPick={handlePickResult} />
      </header>
      <main className="flex-1 flex flex-col min-h-0">
        <Calendar api={api} scrollTarget={scrollTarget} onActiveQueryChange={setActiveQuery} />
        <StockList api={api} />
      </main>
    </div>
  );
}
