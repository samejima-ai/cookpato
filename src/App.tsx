import { useState } from "react";
import { Calendar } from "./components/Calendar";
import { SearchBar } from "./components/SearchBar";
import { SearchResults } from "./components/SearchResults";
import { StockList } from "./components/StockList";
import { useAppData } from "./hooks/useAppData";
import { useSearch } from "./hooks/useSearch";
import type { DateKey } from "./types";

export default function App() {
  const api = useAppData();
  const [query, setQuery] = useState("");
  const [scrollTarget, setScrollTarget] = useState<DateKey | undefined>(undefined);
  const hits = useSearch(api.data, query);

  function handlePickResult(date: DateKey) {
    setScrollTarget(date);
    setQuery("");
    // 同じ日付が連続選択された場合も再スクロールできるよう、次フレームで未定義化
    requestAnimationFrame(() => setScrollTarget(undefined));
  }

  return (
    <div className="flex flex-col h-full max-w-xl mx-auto">
      <header className="relative shrink-0 safe-top">
        <SearchBar value={query} onChange={setQuery} />
        <SearchResults hits={hits} query={query} onPick={handlePickResult} />
      </header>
      <main className="flex-1 flex flex-col min-h-0">
        <Calendar api={api} scrollTarget={scrollTarget} />
        <StockList api={api} />
      </main>
    </div>
  );
}
