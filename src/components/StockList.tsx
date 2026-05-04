import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  // dragState を document handler 内から最新値で参照するための ref。
  // setState は非同期で document handler 登録より遅れる可能性があるため、ref と二重で保持する。
  // startY は長押し成立時の指の Y。pointermove での指追従計算に使う。
  const dragInfoRef = useRef<{
    id: string;
    fromIndex: number;
    toIndex: number;
    startY: number;
  } | null>(null);
  // pointerdown 時の clientY を 500ms 経過後に dragInfoRef.startY としてコピーする
  const pendingStartYRef = useRef<number>(0);
  // ドラッグ中の pointerId（複数指タッチで誤動作させないため）
  const activePointerIdRef = useRef<number | null>(null);
  // 並び替え時のアニメーション用に、前回 paint 時の各行 top を保持する
  const prevRectsRef = useRef<Map<string, number>>(new Map());

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

  // 長押しタイマーのクリーンアップ（unmount 時のみ）
  useEffect(
    () => () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    },
    [],
  );

  // FLIP アニメーション：並び替え（および追加・削除）に伴う行の移動を視覚化する。
  // 1) 前回 paint 時の top を `prevRectsRef` に保持
  // 2) 再レンダ後（useLayoutEffect）に新しい top を取得し差分 dy を算出
  // 3) translateY(dy) で「元の位置」に戻したように見せ、次フレームで 0 へ transition
  // CLAUDE.md「アニメーションは 100-200ms 以内」に従い 150ms。
  // 依存は `api.data.stock`（配列の参照変化＝並び替え・追加・削除のいずれかで再実行）。
  // biome-ignore lint/correctness/useExhaustiveDependencies: stock 変化が再実行の意図的トリガー。中身は ref から読むため body には現れない
  useLayoutEffect(() => {
    const prev = prevRectsRef.current;
    const next = new Map<string, number>();
    liRefs.current.forEach((li, id) => {
      const top = li.getBoundingClientRect().top;
      next.set(id, top);
      const oldTop = prev.get(id);
      if (oldTop === undefined) return;
      const dy = oldTop - top;
      if (dy === 0 || Math.abs(dy) > 1000) return;
      // First → Last の差分を一旦適用して、次フレームで解除する
      li.style.transition = "none";
      li.style.transform = `translateY(${dy}px)`;
      // 次フレームで transition 適用 → transform 解除で滑らかに移動
      requestAnimationFrame(() => {
        li.style.transition = "transform 150ms ease-out";
        li.style.transform = "";
      });
    });
    prevRectsRef.current = next;
  }, [api.data.stock]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  /** pointer Y から、ストック配列のどの位置に挿入するか（toIndex）を算出する */
  const computeToIndex = useCallback((clientY: number, fallback: number): number => {
    const liMap = liRefs.current;
    if (liMap.size === 0) return fallback;
    // li の DOM 順は ul の children 順なので、配列順を保証するため Map を順序保持で渡す
    const entries = Array.from(liMap.entries());
    let result = entries.length - 1;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry) continue;
      const li = entry[1];
      const rect = li.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        result = i;
        break;
      }
    }
    return result;
  }, []);

  // dragState がセットされたら document に pointermove/up を仕掛けて並び替えを追跡する。
  //
  // iOS Safari で並び替えが動かなかった原因と対処：
  // - 旧実装は li 側で `setPointerCapture` を呼んでいたため、後続の pointermove が
  //   document に届かない経路があった。setPointerCapture は廃止
  // - touch-action は touchstart 時点で評価されるため、`isDragging` 切替後に CSS を
  //   変えても遅い。名前領域には常時 `touch-action: none` を当てて、長押し中（500ms）
  //   に少し指が動いても pointercancel が発火しないようにする（StockNameDisplay 側）
  // - document level handler を passive: false で attach し、preventDefault で確実に
  //   ブラウザのスクロール/拡大ジェスチャを抑止する
  //
  // ドラッグ中の他の行のリアルタイム移動（150ms ease-out で隙間を空ける）も
  // ここで処理する。各行の transform は React state ではなく DOM 直接操作で
  // 高頻度の pointermove に対応する。依存は session 単位で安定な `dragState?.id`
  // のみに絞り、session 中の toIndex 変化では useEffect を再実行させない。
  // biome-ignore lint/correctness/useExhaustiveDependencies: dragState?.id で session 単位の生存期間を表現。toIndex 変化は dragInfoRef + DOM 直接で扱う
  useEffect(() => {
    if (dragState === null) return;

    // 行ピッチ計測（隣り合う li の top 差。space-y-1 = 4px 込み）
    const rowEntries = Array.from(liRefs.current.entries());
    let rowPitch = 44;
    if (rowEntries.length >= 2 && rowEntries[0] && rowEntries[1]) {
      const a = rowEntries[0][1].getBoundingClientRect().top;
      const b = rowEntries[1][1].getBoundingClientRect().top;
      rowPitch = b - a;
    } else if (rowEntries[0]) {
      rowPitch = rowEntries[0][1].offsetHeight + 4;
    }

    /**
     * ドラッグ中の他の行に挿入位置のシフトを適用する。
     * ドラッグ行（fromIndex）の transform は updateDraggedRowFollow が指追従で別管理。
     */
    const applyShifts = (fromIndex: number, toIndex: number) => {
      api.data.stock.forEach((item, i) => {
        const li = liRefs.current.get(item.id);
        if (!li) return;
        if (i === fromIndex) return; // ドラッグ行は updateDraggedRowFollow が更新
        if (fromIndex < toIndex && i > fromIndex && i <= toIndex) {
          // 下向きドラッグ：間にある行を上に詰める（ドラッグ行が抜けた隙間を埋める）
          li.style.transform = `translateY(${-rowPitch}px)`;
        } else if (fromIndex > toIndex && i < fromIndex && i >= toIndex) {
          // 上向きドラッグ：間にある行を下に押す（ドラッグ行が割り込む隙間を作る）
          li.style.transform = `translateY(${rowPitch}px)`;
        } else {
          li.style.transform = "";
        }
      });
    };

    /** ドラッグ行を指の Y に追従させる（startY からの差分を transform に反映） */
    const updateDraggedRowFollow = (id: string, currentY: number, startY: number) => {
      const li = liRefs.current.get(id);
      if (!li) return;
      const dy = currentY - startY;
      li.style.transform = `translateY(${dy}px)`;
    };

    // 各 li の transition：ドラッグ行は指追従のため transition なし、他は 150ms ease-out
    liRefs.current.forEach((li, id) => {
      li.style.transition = id === dragState.id ? "none" : "transform 150ms ease-out";
    });
    applyShifts(dragState.fromIndex, dragState.toIndex);

    const onMove = (e: PointerEvent) => {
      const pid = activePointerIdRef.current;
      if (pid !== null && e.pointerId !== pid) return;
      e.preventDefault();
      const drag = dragInfoRef.current;
      if (drag === null) return;
      // ドラッグ行を指追従
      updateDraggedRowFollow(drag.id, e.clientY, drag.startY);
      // toIndex の変化があれば他の行のシフトを更新
      const next = computeToIndex(e.clientY, drag.fromIndex);
      if (next !== drag.toIndex) {
        dragInfoRef.current = { ...drag, toIndex: next };
        setDragState((prev) => (prev === null ? prev : { ...prev, toIndex: next }));
        applyShifts(drag.fromIndex, next);
      }
    };
    const finishDrag = () => {
      const drag = dragInfoRef.current;
      // 1) prevRectsRef を「現在の表示位置」（= 指追従後＆シフト後の位置）で保存。
      //    これが FLIP の起点となり、ドラッグ行は指の位置から並び替え後位置へスライド、
      //    シフト中だった行は既にシフト後位置 = 並び替え後位置にいるので動かない。
      const newPrev = new Map<string, number>();
      liRefs.current.forEach((li, id) => {
        newPrev.set(id, li.getBoundingClientRect().top);
      });
      prevRectsRef.current = newPrev;
      // 2) transform を即時クリア（FLIP useLayoutEffect が改めて invert 適用するため）
      liRefs.current.forEach((li) => {
        li.style.transition = "none";
        li.style.transform = "";
      });
      dragInfoRef.current = null;
      activePointerIdRef.current = null;
      // 3) 並び替え反映（→ React 再レンダ → useLayoutEffect FLIP）
      if (drag !== null && drag.fromIndex !== drag.toIndex) {
        api.reorderStock(drag.fromIndex, drag.toIndex);
      }
      setDragState(null);
    };
    const onUp = (e: PointerEvent) => {
      const pid = activePointerIdRef.current;
      if (pid !== null && e.pointerId !== pid) return;
      finishDrag();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dragInfoRef.current = null;
        activePointerIdRef.current = null;
        // 全 li に transition を当てて transform をクリア（150ms で元位置へ戻る）
        liRefs.current.forEach((li) => {
          li.style.transition = "transform 150ms ease-out";
          li.style.transform = "";
        });
        setDragState(null);
      }
    };
    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      document.removeEventListener("keydown", onKey);
    };
  }, [dragState?.id]);

  const handleRowPointerDown = useCallback(
    (item: StockItem, idx: number, e: React.PointerEvent<HTMLDivElement>) => {
      if (editingId !== null || dragInfoRef.current !== null) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // setPointerCapture は呼ばない（呼ぶと document に pointermove が届かなくなる経路がある）
      activePointerIdRef.current = e.pointerId;
      pendingStartYRef.current = e.clientY;
      cancelLongPress();
      const startId = item.id;
      const startIndex = idx;
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        tapFeedback();
        // ref を先に書いてから state 更新（document handler が次フレームで参照する）
        dragInfoRef.current = {
          id: startId,
          fromIndex: startIndex,
          toIndex: startIndex,
          startY: pendingStartYRef.current,
        };
        setDragState({ id: startId, fromIndex: startIndex, toIndex: startIndex });
      }, LONG_PRESS_MS);
    },
    [editingId, cancelLongPress],
  );

  const handleRowPointerUp = useCallback(
    (item: StockItem, _e: React.PointerEvent<HTMLDivElement>) => {
      const hadPendingTimer = longPressTimerRef.current !== null;
      cancelLongPress();
      // 長押し成立済みなら document handler 側が確定処理する。ここでは何もしない。
      if (dragInfoRef.current !== null) return;
      activePointerIdRef.current = null;
      // 長押し未成立（500ms 未満で離した）→ タップ扱いで編集モード進入
      if (hadPendingTimer && editingId === null) {
        setEditingId(item.id);
      }
    },
    [cancelLongPress, editingId],
  );

  const handleRowPointerCancel = useCallback(
    (_item: StockItem, _e: React.PointerEvent<HTMLDivElement>) => {
      cancelLongPress();
      // 長押し成立後の cancel は document handler 側の onUp（pointercancel）が処理。
      // 長押し成立前の cancel ならタイマーだけ消して終わり。
      if (dragInfoRef.current === null) {
        activePointerIdRef.current = null;
      }
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
        <div
          className={`px-3 pb-3 max-h-48 ${dragState === null ? "overflow-y-auto" : "overflow-hidden"}`}
        >
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
  /** 名前領域での pointerdown（長押し検出のトリガー）。pointermove は document level で追跡 */
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
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
  onPointerUp,
  onPointerCancel,
}: StockRowProps) {
  // ドラッグ中の行は scale + shadow で「持ち上がった」感を出す。
  // transform は親 StockList の document handler が translateY 用に DOM 直接操作するため、
  // ここでは scale を className で当てると競合する。代わりに style.transform に scale を
  // 含めるのも複雑になるので、shadow と opacity と z-index だけで浮き感を表現する。
  const liClass = `flex items-center gap-1 bg-white rounded px-2 py-1 border transition-shadow ${
    isDragging
      ? "shadow-2xl z-10 relative border-neutral-400 ring-2 ring-neutral-300"
      : "border-neutral-200"
  }`;

  return (
    <li
      ref={(el) => {
        if (el) liRefs.current.set(item.id, el);
        else liRefs.current.delete(item.id);
      }}
      className={liClass}
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
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
};

/** 名前表示部。useAutoShrink で 1 行収納。pointer イベントは親（StockList）に流す */
function StockNameDisplay({
  item,
  isFavorite,
  onPointerDown,
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
      // touch-action: none は touchstart 時点で評価される。長押し中（500ms）に
      // 指が少しでも動くと pointercancel でドラッグが死ぬのを防ぐため、常時適用する。
      // 名前領域でだけスクロール不可になるが、ストック容器のスクロールは
      // ボタン領域や行間で発火できるので運用上問題ない。
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
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
