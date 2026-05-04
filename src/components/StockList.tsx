import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import emptyStockImg from "../assets/empty-stock.png";
import favoriteImg from "../assets/favorite.png";
import type { AppDataApi } from "../hooks/useAppData";
import { useAutoShrink } from "../hooks/useAutoShrink";
import { useComposition } from "../hooks/useComposition";
import { tapFeedback } from "../lib/haptics";
import { favoriteKey } from "../lib/normalize";
import type { StockItem } from "../types";

type Props = {
  api: AppDataApi;
};

const LONG_PRESS_MS = 500;

export function StockList({ api }: Props) {
  const [expanded, setExpanded] = useState(true);
  // 追加 input の妥当性のみ state で持ち、値は uncontrolled な input から ref で読む。
  // controlled (`value=`) にすると iOS Safari の IME 中に親 state 反映がスキップされた瞬間
  // React が DOM 値を上書きし入力が消える（メモ欄と同じ問題）。
  const [draftNameValid, setDraftNameValid] = useState(false);
  // 追加成功時に input を空に戻すための再マウント用キー
  const [draftResetKey, setDraftResetKey] = useState(0);
  const [draftQty, setDraftQty] = useState("");
  const draftNameRef = useRef<HTMLInputElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  /**
   * 並び替え中の状態。長押し成立後にセットされ、リリースで確定される。
   * `toIndex` は現在ホバーしている挿入位置。
   */
  const [dragState, setDragState] = useState<{
    id: string;
    fromIndex: number;
    toIndex: number;
  } | null>(null);

  const favoriteKeys = useMemo(() => new Set(api.data.favorites), [api.data.favorites]);
  const nameIme = useComposition();

  const liRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // dragState を最新で参照するための ref（pointerup ハンドラが state クロージャでなく現在値を見るため）
  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;

  function handleAdd() {
    const name = (draftNameRef.current?.value ?? "").trim();
    if (name === "") return;
    const parsed = Number.parseInt(draftQty, 10);
    const qty = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
    api.addStock(name, qty);
    setDraftQty("");
    setDraftNameValid(false);
    // input を再マウントして DOM 値を空に戻す（uncontrolled なので value プロップでは制御できない）
    setDraftResetKey((k) => k + 1);
  }

  // dragging 解除：行外タップ／Escape
  useEffect(() => {
    if (dragState === null) return;
    const onPointerDown = (e: PointerEvent) => {
      const insideAnyRow = Array.from(liRefs.current.values()).some((li) =>
        li.contains(e.target as Node),
      );
      if (!insideAnyRow) setDragState(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDragState(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [dragState]);

  // 長押しタイマーのクリーンアップ（unmount 時のみ）
  useEffect(
    () => () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    },
    [],
  );

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  /** pointer Y から、ストック配列のどの位置に挿入するか（toIndex）を算出する */
  const computeToIndex = useCallback(
    (clientY: number, fallback: number): number => {
      const stock = api.data.stock;
      if (stock.length === 0) return fallback;
      let result = stock.length - 1;
      for (let i = 0; i < stock.length; i++) {
        const item = stock[i];
        if (!item) continue;
        const li = liRefs.current.get(item.id);
        if (!li) continue;
        const rect = li.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) {
          result = i;
          break;
        }
      }
      return result;
    },
    [api.data.stock],
  );

  const handleRowPointerDown = useCallback(
    (item: StockItem, idx: number, e: React.PointerEvent<HTMLDivElement>) => {
      if (editingId !== null || dragStateRef.current !== null) return;
      // 右クリックなどは無視
      if (e.pointerType === "mouse" && e.button !== 0) return;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // 一部環境（テスト）では setPointerCapture 未対応。無視して継続
      }
      cancelLongPress();
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        tapFeedback();
        setDragState({ id: item.id, fromIndex: idx, toIndex: idx });
      }, LONG_PRESS_MS);
    },
    [editingId, cancelLongPress],
  );

  const handleRowPointerMove = useCallback(
    (item: StockItem, e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragStateRef.current;
      if (drag === null || drag.id !== item.id) return;
      const next = computeToIndex(e.clientY, drag.fromIndex);
      if (next !== drag.toIndex) {
        setDragState({ ...drag, toIndex: next });
      }
    },
    [computeToIndex],
  );

  const handleRowPointerUp = useCallback(
    (item: StockItem, e: React.PointerEvent<HTMLDivElement>) => {
      const hadPendingTimer = longPressTimerRef.current !== null;
      cancelLongPress();
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
      const drag = dragStateRef.current;
      if (drag !== null && drag.id === item.id) {
        // 長押し成立 → 並び替え確定
        if (drag.fromIndex !== drag.toIndex) {
          api.reorderStock(drag.fromIndex, drag.toIndex);
        }
        setDragState(null);
      } else if (hadPendingTimer && drag === null) {
        // 長押し未成立（500ms 未満で離した） → タップ扱いで編集モード進入
        if (editingId === null) setEditingId(item.id);
      }
    },
    [api, cancelLongPress, editingId],
  );

  const handleRowPointerCancel = useCallback(
    (_item: StockItem, e: React.PointerEvent<HTMLDivElement>) => {
      cancelLongPress();
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
      if (dragStateRef.current !== null) setDragState(null);
    },
    [cancelLongPress],
  );

  return (
    <div className="bg-neutral-50 border-t border-neutral-200 safe-bottom">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2 text-left text-sm text-neutral-600 min-h-11"
        aria-expanded={expanded}
      >
        <span className="font-medium">ストック（{api.data.stock.length}）</span>
        <span className="text-neutral-400">{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 max-h-48 overflow-y-auto">
          {api.data.stock.length === 0 && (
            <div className="flex flex-col items-center py-3 text-neutral-400">
              <img src={emptyStockImg} alt="" aria-hidden="true" className="w-20 h-20 opacity-90" />
              <span className="text-xs mt-1">まだストックはありません</span>
            </div>
          )}
          <ul className="space-y-1 mb-2">
            {api.data.stock.map((item, idx) => (
              <StockRow
                key={item.id}
                item={item}
                isEditing={editingId === item.id}
                isDragging={dragState?.id === item.id}
                liRefs={liRefs}
                isFavorite={favoriteKeys.has(favoriteKey(item.text))}
                onCommitEdit={(newText) => {
                  api.updateStockText(item.id, newText);
                  setEditingId(null);
                }}
                onCancelEdit={() => setEditingId(null)}
                onDec={() => api.decStock(item.id)}
                onInc={() => api.incStock(item.id)}
                onRemove={() => {
                  tapFeedback();
                  api.removeStock(item.id);
                }}
                onPointerDown={(e) => handleRowPointerDown(item, idx, e)}
                onPointerMove={(e) => handleRowPointerMove(item, e)}
                onPointerUp={(e) => handleRowPointerUp(item, e)}
                onPointerCancel={(e) => handleRowPointerCancel(item, e)}
              />
            ))}
          </ul>
          <div className="flex gap-1">
            <input
              key={draftResetKey}
              ref={draftNameRef}
              type="text"
              defaultValue=""
              onCompositionStart={nameIme.onCompositionStart}
              onCompositionEnd={(e) => {
                nameIme.onCompositionEnd();
                const committed = e.currentTarget.value;
                nameIme.markCommitted(committed);
                setDraftNameValid(committed.trim() !== "");
              }}
              onChange={(e) => {
                if (nameIme.shouldSkipChange(e.target.value, e.nativeEvent)) return;
                setDraftNameValid(e.target.value.trim() !== "");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder="ストック名"
              className="flex-1 min-w-0 text-sm px-2 py-2 rounded border border-neutral-200 bg-white outline-none focus:border-neutral-400 min-h-11"
              aria-label="ストック名"
            />
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={draftQty}
              onChange={(e) => setDraftQty(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder="1"
              className="w-14 text-sm px-2 py-2 rounded border border-neutral-200 bg-white outline-none focus:border-neutral-400 min-h-11 text-center tabular-nums"
              aria-label="個数（省略で1）"
            />
            <button
              type="button"
              onClick={handleAdd}
              className="px-3 py-2 rounded bg-neutral-800 text-white text-sm min-h-11 min-w-11 disabled:opacity-50 shrink-0"
              disabled={!draftNameValid}
            >
              追加
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type StockRowProps = {
  item: StockItem;
  isEditing: boolean;
  isDragging: boolean;
  isFavorite: boolean;
  liRefs: React.MutableRefObject<Map<string, HTMLLIElement>>;
  onCommitEdit: (text: string) => void;
  onCancelEdit: () => void;
  onDec: () => void;
  onInc: () => void;
  onRemove: () => void;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
};

/**
 * ストック1行の表示。
 *
 * レイアウト：`[−][個数][＋][名前 + ♡]`
 * - `[−][個数][＋]` の 3 要素は 36×36px（SPEC「ストックリスト」の例外）
 * - 名前領域は `useAutoShrink` で動的縮小し 1 行で表示
 * - 名前タップで編集モード（uncontrolled input）。blur/Enter で確定、空文字は無視
 * - 名前領域を 500ms 長押しでドラッグモード。リリースで並び替え（親が制御）
 */
function StockRow({
  item,
  isEditing,
  isDragging,
  isFavorite,
  liRefs,
  onCommitEdit,
  onCancelEdit,
  onDec,
  onInc,
  onRemove,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: StockRowProps) {
  const liClass = `flex items-center gap-1 bg-white rounded px-2 py-1 border border-neutral-200 transition-shadow ${
    isDragging ? "shadow-lg z-10 relative opacity-90" : ""
  }`;

  return (
    <li
      ref={(el) => {
        if (el) liRefs.current.set(item.id, el);
        else liRefs.current.delete(item.id);
      }}
      className={liClass}
      // dragging 中は touch-action: none でブラウザのスクロール挙動を抑止する
      style={isDragging ? { touchAction: "none" } : undefined}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDec();
        }}
        disabled={item.qty === 0}
        className="w-9 h-9 flex items-center justify-center text-neutral-500 active:text-neutral-800 disabled:opacity-30 text-lg shrink-0"
        aria-label={`${item.text} を1減らす`}
      >
        −
      </button>
      {item.qty === 0 ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="w-9 h-9 flex items-center justify-center rounded bg-red-500 text-white text-sm font-bold shrink-0"
          aria-label={`${item.text} を削除`}
        >
          0
        </button>
      ) : (
        <span
          className="w-7 h-9 flex items-center justify-center text-sm font-medium text-neutral-800 shrink-0 tabular-nums"
          aria-label={`個数 ${item.qty}`}
        >
          {item.qty}
        </span>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onInc();
        }}
        className="w-9 h-9 flex items-center justify-center text-neutral-500 active:text-neutral-800 text-lg shrink-0"
        aria-label={`${item.text} を1増やす`}
      >
        ＋
      </button>
      {isEditing ? (
        <StockNameEditInput
          initialText={item.text}
          onCommitEdit={onCommitEdit}
          onCancelEdit={onCancelEdit}
        />
      ) : (
        <StockNameDisplay
          item={item}
          isFavorite={isFavorite}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        />
      )}
    </li>
  );
}

type StockNameEditInputProps = {
  initialText: string;
  onCommitEdit: (text: string) => void;
  onCancelEdit: () => void;
};

/** ストック名の編集 input（uncontrolled）。blur / Enter で確定、Escape でキャンセル */
function StockNameEditInput({ initialText, onCommitEdit, onCancelEdit }: StockNameEditInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const ime = useComposition();

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  return (
    <div className="flex-1 min-w-0 flex items-center pl-1">
      <input
        ref={inputRef}
        type="text"
        defaultValue={initialText}
        onCompositionStart={ime.onCompositionStart}
        onCompositionEnd={(e) => {
          ime.onCompositionEnd();
          ime.markCommitted(e.currentTarget.value);
        }}
        onChange={(e) => {
          // IME 中は値反映を抑止。最終確定値は blur / Enter で取得する。
          if (ime.shouldSkipChange(e.target.value, e.nativeEvent)) return;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onCommitEdit(e.currentTarget.value);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancelEdit();
          }
        }}
        onBlur={(e) => {
          onCommitEdit(e.currentTarget.value);
        }}
        className="w-full text-sm bg-transparent outline-none text-neutral-800"
        aria-label={`${initialText} の名前を編集`}
      />
    </div>
  );
}

type StockNameDisplayProps = {
  item: StockItem;
  isFavorite: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
};

/** 名前表示部。useAutoShrink で 1 行収納。pointer イベントは親（StockList）に流す */
function StockNameDisplay({
  item,
  isFavorite,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: StockNameDisplayProps) {
  const BASE_PX = 14;
  const { containerRef, measureRef, fontPx } = useAutoShrink({
    value: item.text,
    basePx: BASE_PX,
    minPx: 10,
  });

  return (
    <div
      ref={containerRef}
      className="flex-1 min-w-0 self-center relative overflow-hidden pl-1 flex items-center gap-1 cursor-text"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      aria-label={`${item.text}（タップで編集、長押しで並び替え）`}
    >
      <span
        ref={measureRef}
        aria-hidden="true"
        className="invisible absolute top-0 left-0 whitespace-nowrap"
        style={{ fontSize: `${BASE_PX}px` }}
      >
        {item.text}
      </span>
      <span
        style={{ fontSize: `${fontPx}px` }}
        className="block whitespace-nowrap overflow-hidden text-neutral-800 leading-7 flex-1 min-w-0"
      >
        {item.text}
      </span>
      {isFavorite && (
        <img src={favoriteImg} alt="" aria-hidden="true" className="w-8 h-8 shrink-0" />
      )}
    </div>
  );
}
