import { useCallback, useEffect, useRef, useState } from "react";
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

/** スワップ完了後のフラッシュ演出持続時間（ms）。SPEC「150ms 程度」 */
const SWAP_FLASH_MS = 150;

export default function App() {
  const api = useAppData();
  const backup = useBackup(api);
  const [query, setQuery] = useState("");
  const [scrollTarget, setScrollTarget] = useState<DateKey | undefined>(undefined);
  const [editingTarget, setEditingTarget] = useState<EditingTarget | null>(null);
  const [activeQuery, setActiveQuery] = useState("");
  const [debouncedActiveQuery, setDebouncedActiveQuery] = useState("");
  const [debouncedActiveDate, setDebouncedActiveDate] = useState<DateKey | null>(null);
  // F012: 日付ごとスワップの「移動元」。null なら移動モード非アクティブ
  const [swapSource, setSwapSource] = useState<DateKey | null>(null);
  // F012: スワップ完了直後のフラッシュ対象 2 日。null なら非表示
  const [swapFlashDates, setSwapFlashDates] = useState<ReadonlySet<DateKey> | null>(null);
  // F012: 連続スワップで先発 timeout が後発フラッシュを途中で消さないため timer id を保持
  const swapFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // アンマウント時に未発火 timeout をクリーンアップ
  useEffect(
    () => () => {
      if (swapFlashTimerRef.current) clearTimeout(swapFlashTimerRef.current);
    },
    [],
  );
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
    // F012: 任意のフロート編集起動はスワップ移動モードを解除する
    setSwapSource(null);
    setEditingTarget({ kind: "line", dateKey, lineIndex });
  }, []);

  // メモタップ → メモを編集モードへ
  const handleRequestEditMemo = useCallback((dateKey: DateKey) => {
    setSwapSource(null);
    setEditingTarget({ kind: "memo", dateKey });
  }, []);

  // ＋追加 → 新規空行追加 + その行を編集モードへ
  const handleRequestAddLine = useCallback(
    (dateKey: DateKey) => {
      const before = api.data.meals[dateKey]?.lines.length ?? 0;
      api.addLineAt(dateKey, "end");
      // append 後の新規行 index は `before`（addLineAt は同期的に setState を発火するため
      // 次フレームには反映済み。即時 EditingTarget をセットしてフロートを開く）
      setSwapSource(null);
      setEditingTarget({ kind: "line", dateKey, lineIndex: before });
    },
    [api],
  );

  // F013 行間挿入：対象行の上／下に空行を挿入し、即その空行をフロート編集する
  const handleRequestInsertLine = useCallback(
    (dateKey: DateKey, lineIndex: number, where: "above" | "below") => {
      const insertedIndex = api.insertLineAt(dateKey, lineIndex, where);
      if (insertedIndex < 0) return;
      // 挿入されたら必ず移動モードは解除する（spec「他のジェスチャでフロート編集起動 → 解除」）
      setSwapSource(null);
      setEditingTarget({ kind: "line", dateKey, lineIndex: insertedIndex });
    },
    [api],
  );

  // F012 日付ラベル長押し：移動モード進入／同じ日なら解除
  const handleLongPressDate = useCallback((dateKey: DateKey) => {
    setSwapSource((prev) => (prev === dateKey ? null : dateKey));
  }, []);

  // F012 日付ラベルタップ：移動モード中の目的日タップ → スワップ実行
  const handleTapDate = useCallback(
    (dateKey: DateKey) => {
      // updater 内で副作用を起こすと StrictMode 二重実行で誤発火するので、
      // ソース読み出しは pure に行い、副作用は updater 外で実施する
      if (swapSource === null) return;
      if (swapSource === dateKey) {
        setSwapSource(null);
        return;
      }
      const source = swapSource;
      // 別日タップ → スワップ実行
      const dayA = api.data.meals[source];
      const dayB = api.data.meals[dateKey];
      const bothEmpty =
        (!dayA || (dayA.lines.every((l) => l.text === "") && !dayA.memo)) &&
        (!dayB || (dayB.lines.every((l) => l.text === "") && !dayB.memo));
      api.swapDays(source, dateKey);
      setSwapSource(null);
      // SPEC: 両方空ならフラッシュも発火しない
      if (!bothEmpty) {
        // 前回のクリア timeout を破棄してから新規にセット（連続スワップで途中消えるのを防ぐ）
        if (swapFlashTimerRef.current) clearTimeout(swapFlashTimerRef.current);
        setSwapFlashDates(new Set([source, dateKey]));
        swapFlashTimerRef.current = window.setTimeout(() => {
          setSwapFlashDates(null);
          swapFlashTimerRef.current = null;
        }, SWAP_FLASH_MS);
      }
    },
    [api, swapSource],
  );

  // F012 解除経路：Escape キー
  useEffect(() => {
    if (swapSource === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSwapSource(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [swapSource]);

  // F012 解除経路：料理行 wobble 進入時
  const handleLineWobbleEnter = useCallback(() => {
    setSwapSource(null);
  }, []);

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
          swapSource={swapSource}
          swapFlashDates={swapFlashDates}
          onRequestEditLine={handleRequestEditLine}
          onRequestEditMemo={handleRequestEditMemo}
          onRequestAddLine={handleRequestAddLine}
          onRequestInsertLine={handleRequestInsertLine}
          onLongPressDate={handleLongPressDate}
          onTapDate={handleTapDate}
          onLineWobbleEnter={handleLineWobbleEnter}
        />
        <StockList
          api={api}
          restoreSlot={<BackupRestore importFromText={backup.importFromText} />}
        />
      </main>
    </div>
  );
}
