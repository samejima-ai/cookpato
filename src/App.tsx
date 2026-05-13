import { useCallback, useEffect, useState } from "react";
import { BackupBadge } from "./components/BackupBadge";
import { BackupRestore } from "./components/BackupRestore";
import { Calendar } from "./components/Calendar";
import { FloatingEditor } from "./components/FloatingEditor";
import { SearchBar } from "./components/SearchBar";
import { SearchResults } from "./components/SearchResults";
import { StockList } from "./components/StockList";
import { useAppData } from "./hooks/useAppData";
import { useBackup } from "./hooks/useBackup";
import { useSearch } from "./hooks/useSearch";
import type { DateKey, EditingTarget } from "./types";

/** アクティブ行の類似検索で遡る期間（軽量動作のため過去1年に制限） */
const ACTIVE_SEARCH_SINCE_DAYS = 365;
/** 件数バッジの上限。これ以上は「N+」表記にする */
const ACTIVE_COUNT_CAP = 20;
/** アクティブ行の入力に対する件数計算のデバウンス（ms） */
const ACTIVE_DEBOUNCE_MS = 150;

export default function App() {
  const api = useAppData();
  const backup = useBackup(api);
  const [query, setQuery] = useState("");
  const [scrollTarget, setScrollTarget] = useState<DateKey | undefined>(undefined);
  const [editingTarget, setEditingTarget] = useState<EditingTarget | null>(null);
  const [activeQuery, setActiveQuery] = useState("");
  const [debouncedActiveQuery, setDebouncedActiveQuery] = useState("");
  const [debouncedActiveDate, setDebouncedActiveDate] = useState<DateKey | null>(null);
  const hits = useSearch(api.data, query);

  // 編集対象（line のみ）の現状 text を取得し、FloatingEditor に渡す
  const currentEditingText = (() => {
    if (editingTarget === null) return "";
    const day = api.data.meals[editingTarget.dateKey];
    if (editingTarget.kind === "line") {
      return day?.lines[editingTarget.lineIndex]?.text ?? "";
    }
    return day?.memo ?? "";
  })();

  // フロート編集中の text 変化を検索ハイライトに送る（line のみ）
  const handleActiveTextChange = useCallback((text: string) => {
    setActiveQuery(text);
  }, []);

  // 150ms のデバウンスで件数計算（キーストロークごとの全走査を抑える）
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedActiveQuery(activeQuery);
      // 編集中の line target なら、自己マッチ除外のため対象日を保持
      setDebouncedActiveDate(
        editingTarget?.kind === "line" && activeQuery !== "" ? editingTarget.dateKey : null,
      );
    }, ACTIVE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [activeQuery, editingTarget]);

  // 検索欄に入力中はバッジを出さない（結果パネルと重複するため）
  // 編集中の当該日付は自己マッチ防止のため除外する
  const activeHits = useSearch(api.data, query.trim() === "" ? debouncedActiveQuery : "", {
    sinceDays: ACTIVE_SEARCH_SINCE_DAYS,
    // 「N+」判定用に 1 件余分に取る
    maxResults: ACTIVE_COUNT_CAP + 1,
    excludeDate: debouncedActiveDate ?? undefined,
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

  // FloatingEditor からの確定
  const handleEditorCommit = useCallback(
    (text: string) => {
      if (editingTarget === null) return;
      if (editingTarget.kind === "line") {
        const day = api.data.meals[editingTarget.dateKey];
        const current = day?.lines[editingTarget.lineIndex]?.text;
        if (current !== text) {
          // 編集開始時の baseline 取得（週達成判定用）→ updateLineAt → blur 相当の commit
          api.beginMealsEdit(editingTarget.dateKey);
          api.updateLineAt(editingTarget.dateKey, editingTarget.lineIndex, text);
          api.commitMealsEdit(editingTarget.dateKey);
        }
      } else {
        // memo は SPEC 上「週達成判定対象外」なので beginEdit / commitEdit を経由しない
        api.setMemo(editingTarget.dateKey, text);
      }
      setEditingTarget(null);
    },
    [editingTarget, api],
  );

  const handleEditorCancel = useCallback(() => {
    setEditingTarget(null);
  }, []);

  // 行タップ → その行を編集モードへ
  const handleRequestEditLine = useCallback((dateKey: DateKey, lineIndex: number) => {
    setEditingTarget({ kind: "line", dateKey, lineIndex });
  }, []);

  // メモタップ → メモを編集モードへ
  const handleRequestEditMemo = useCallback((dateKey: DateKey) => {
    setEditingTarget({ kind: "memo", dateKey });
  }, []);

  // ＋追加 → 新規空行追加 + その行を編集モードへ
  const handleRequestAddLine = useCallback(
    (dateKey: DateKey) => {
      const before = api.data.meals[dateKey]?.lines.length ?? 0;
      api.addLineAt(dateKey, "end");
      // append 後の新規行 index は `before`（addLineAt は同期的に setState を発火するため
      // 次フレームには反映済み。即時 EditingTarget をセットしてフロートを開く）
      setEditingTarget({ kind: "line", dateKey, lineIndex: before });
    },
    [api],
  );

  return (
    <div className="flex flex-col h-full max-w-xl mx-auto">
      {backup.showBanner && (
        <BackupBadge onSave={backup.exportFile} onComplete={backup.markExported} />
      )}
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
      <FloatingEditor
        target={editingTarget}
        currentText={currentEditingText}
        onCommit={handleEditorCommit}
        onCancel={handleEditorCancel}
        onActiveTextChange={handleActiveTextChange}
      />
      <main className="flex-1 flex flex-col min-h-0">
        <Calendar
          api={api}
          scrollTarget={scrollTarget}
          editingTarget={editingTarget}
          onRequestEditLine={handleRequestEditLine}
          onRequestEditMemo={handleRequestEditMemo}
          onRequestAddLine={handleRequestAddLine}
        />
        <StockList
          api={api}
          restoreSlot={<BackupRestore importFromText={backup.importFromText} />}
        />
      </main>
    </div>
  );
}
