import { useCallback, useEffect, useRef, useState } from "react";
import emptyDayImg from "../assets/empty-day.png";
import favoriteImg from "../assets/favorite.png";
import cartImg from "../assets/shimaenaga-cart.png";
import { useAutoShrink } from "../hooks/useAutoShrink";
import { useLongPress } from "../hooks/useLongPress";
import { formatDayLabel, isSaturday, isSunday } from "../lib/date";
import { tapFeedback } from "../lib/haptics";
import { getHolidayName } from "../lib/holidays";
import { favoriteKey } from "../lib/normalize";
import type { DateKey, DayMeals } from "../types";

type Props = {
  dateKey: DateKey;
  day: DayMeals | undefined;
  isToday: boolean;
  /** 未来の空日ウィンドウに含まれる日か（SPEC「空状態の応援表示」） */
  showCheer: boolean;
  /**
   * today〜today+6 の範囲内か（入力状態に依存しない）。
   * 空行★プレースホルダ表示判定に使う。
   */
  inCheerWindow: boolean;
  /** お気に入り判定用の正規化済みキー集合 */
  favoriteKeys: Set<string>;
  /** 現在フロート編集中の行 index（自分の日付の行であれば数値、無関係なら null） */
  editingLineIndex: number | null;
  /** 現在フロート編集中の対象が自分の日付のメモなら true */
  isMemoEditing: boolean;
  /** F012: この日が「移動モードの移動元」か（青枠強調） */
  isSwapSource: boolean;
  /** F012: スワップ移動モードが（他の日が起点で）アクティブか。タップで目的日になり得る */
  isSwapTarget: boolean;
  /** F012: スワップ完了後の短時間フラッシュ表示中か */
  isSwapFlash: boolean;
  onToggleLine: (lineIndex: number) => void;
  onToggleFavorite: (lineIndex: number) => void;
  onToggleCart: (lineIndex: number) => void;
  onDeleteLine: (lineIndex: number) => void;
  /** F013: 対象行の「上」または「下」に空行を挿入し即フロート編集を起動する */
  onInsertLineAt: (lineIndex: number, where: "above" | "below") => void;
  /** 「＋追加」ボタン押下時：空 Line を append + 即座にフロートで編集する */
  onAddLine: () => void;
  /** 行タップ：その行を FloatingEditor で編集する */
  onRequestEditLine: (lineIndex: number) => void;
  /** ちょいメモタップ：メモを FloatingEditor で編集する */
  onRequestEditMemo: () => void;
  /** F012: 料理行 wobble 進入時に呼ぶ（移動モードを解除するため親へ通知） */
  onLineWobbleEnter: () => void;
  /** F012: 日付ラベル領域の 500ms 長押し → 移動モード開始（または同じ日なら解除） */
  onLongPressDate: () => void;
  /** F012: 移動モード中の日付ラベルタップ → スワップ実行（または同じ日なら解除） */
  onTapDate: () => void;
};

export function DayRow({
  dateKey,
  day,
  isToday,
  showCheer,
  inCheerWindow,
  favoriteKeys,
  editingLineIndex,
  isMemoEditing,
  isSwapSource,
  isSwapTarget,
  isSwapFlash,
  onToggleLine,
  onToggleFavorite,
  onToggleCart,
  onDeleteLine,
  onInsertLineAt,
  onAddLine,
  onRequestEditLine,
  onRequestEditMemo,
  onLineWobbleEnter,
  onLongPressDate,
  onTapDate,
}: Props) {
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  // 行削除モード（長押しで突入）中の対象行 index。null は非アクティブ。
  // 同時に揺れる行は高々 1 本（iOS のぷるぷるモード相当）。
  const [wobbleIndex, setWobbleIndex] = useState<number | null>(null);
  const wobbleRowRef = useRef<HTMLLIElement | null>(null);
  const lines = day?.lines ?? [];

  // wobble 中は「対象行の外をタップ」「ESC」で解除する
  useEffect(() => {
    if (wobbleIndex === null) return;
    const onPointerDown = (e: PointerEvent) => {
      const row = wobbleRowRef.current;
      if (row?.contains(e.target as Node)) return;
      setWobbleIndex(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWobbleIndex(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [wobbleIndex]);

  const holidayName = getHolidayName(dateKey);
  const labelColor =
    holidayName || isSunday(dateKey)
      ? "text-red-500"
      : isSaturday(dateKey)
        ? "text-blue-500"
        : "text-neutral-700";

  const bgClass = isToday ? "bg-yellow-50" : "bg-white";

  // 日付ラベル領域の長押し：F012 移動モードのトリガー。LineItem 同様、
  // 長押し成立後の click は内部 flag で抑止する（onTapDate 誤発火を防ぐ）。
  const dateWasLongPressRef = useRef(false);
  const dateLp = useLongPress(() => {
    dateWasLongPressRef.current = true;
    tapFeedback();
    onLongPressDate();
  });

  const pendingText = pendingDelete !== null ? (lines[pendingDelete]?.text ?? "") : "";

  const handleAddLine = (e: React.MouseEvent) => {
    e.stopPropagation();
    tapFeedback();
    onAddLine();
  };

  return (
    <div className={`flex gap-3 px-3 py-2 border-b border-neutral-100 ${bgClass}`}>
      <div className="w-24 shrink-0">
        {/* 日付ラベル領域：M月D日 + 祝日名 + 今日バッジを 1 つの長押し領域にまとめる（F012） */}
        {/* biome-ignore lint/a11y/useSemanticElements: 内部の MemoField 等とのネスト回避で div + role=button を採用（LineItem 料理名と同じパターン） */}
        <div
          role="button"
          tabIndex={0}
          aria-label={`${formatDayLabel(dateKey)}（長押しで日付ごと入れ替え）`}
          className={`rounded transition-colors ${
            isSwapSource ? "bg-blue-50 ring-2 ring-blue-300" : isSwapFlash ? "bg-green-50" : ""
          }`}
          onMouseDown={() => {
            dateWasLongPressRef.current = false;
            dateLp.onMouseDown();
          }}
          onMouseUp={dateLp.onMouseUp}
          onMouseLeave={dateLp.onMouseLeave}
          onTouchStart={() => {
            dateWasLongPressRef.current = false;
            dateLp.onTouchStart();
          }}
          onTouchEnd={dateLp.onTouchEnd}
          onTouchCancel={dateLp.onTouchCancel}
          onClick={(e) => {
            // 長押し成立後の click は抑止
            if (dateWasLongPressRef.current) {
              dateWasLongPressRef.current = false;
              e.stopPropagation();
              return;
            }
            // 移動モード中（自分が source または target）のみ反応する
            if (isSwapSource || isSwapTarget) {
              onTapDate();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (isSwapSource || isSwapTarget) onTapDate();
            }
          }}
        >
          <div className={`text-sm font-medium ${labelColor}`}>
            <span>{formatDayLabel(dateKey)}</span>
          </div>
          {holidayName && <HolidayLabel name={holidayName} />}
          {isToday && <div className="text-xs text-yellow-700 mt-0.5">今日</div>}
        </div>
        {/* シマエナガ（cheer）：日付列内の装飾要素。タップ無効。 */}
        {showCheer && (
          <img
            src={emptyDayImg}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="w-10 h-10 opacity-80 animate-cheer-flip mt-0.5 pointer-events-none select-none"
          />
        )}
        <MemoField
          dateKey={dateKey}
          value={day?.memo ?? ""}
          isEditing={isMemoEditing}
          onRequestEdit={onRequestEditMemo}
        />
      </div>
      <div className="flex-1 min-w-0">
        <ul>
          {lines.map((line, idx) => {
            if (line.text === "") {
              // 空行：inCheerWindow 内のみ ★ プレースホルダを描画。
              // タップで FloatingEditor を起動して入力開始。
              if (!inCheerWindow) return null;
              const isThisEditing = editingLineIndex === idx;
              return (
                <EmptyLineItem
                  // biome-ignore lint/suspicious/noArrayIndexKey: 行の並べ替えはせず、追加・削除のみなので index をキーにしてよい
                  key={`${dateKey}-${idx}-empty`}
                  isEditing={isThisEditing}
                  onTap={() => onRequestEditLine(idx)}
                />
              );
            }
            return (
              <LineItem
                // biome-ignore lint/suspicious/noArrayIndexKey: 行の並べ替えはせず、追加・削除のみなので index をキーにしてよい（SPEC.md 準拠）
                key={`${dateKey}-${idx}`}
                text={line.text}
                done={line.done}
                favorite={favoriteKeys.has(favoriteKey(line.text))}
                cart={line.cart === true}
                wobble={wobbleIndex === idx}
                isEditing={editingLineIndex === idx}
                rowRef={wobbleIndex === idx ? wobbleRowRef : undefined}
                onToggle={() => onToggleLine(idx)}
                onToggleFavorite={() => onToggleFavorite(idx)}
                onToggleCart={() => onToggleCart(idx)}
                onTap={() => onRequestEditLine(idx)}
                onLongPress={() => {
                  setWobbleIndex(idx);
                  // F012: 料理行 wobble 進入時はスワップ移動モードを解除する
                  onLineWobbleEnter();
                }}
                onRequestDelete={() => {
                  setWobbleIndex(null);
                  setPendingDelete(idx);
                }}
                onInsertAbove={() => {
                  setWobbleIndex(null);
                  onInsertLineAt(idx, "above");
                }}
                onInsertBelow={() => {
                  setWobbleIndex(null);
                  onInsertLineAt(idx, "below");
                }}
              />
            );
          })}
        </ul>
        {/* 「＋追加」ボタン：行末常設。空 Line を 1 つ append して FloatingEditor を起動する（親が処理） */}
        <button
          type="button"
          onClick={handleAddLine}
          aria-label="行を追加"
          className="w-11 h-11 flex items-center justify-center text-neutral-300 active:text-neutral-500 touch-manipulation"
        >
          ＋
        </button>
      </div>
      {pendingDelete !== null && (
        <ConfirmDeleteDialog
          text={pendingText}
          onConfirm={() => {
            onDeleteLine(pendingDelete);
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

type EmptyLineItemProps = {
  isEditing: boolean;
  onTap: () => void;
};

/** 空行（★プレースホルダ）。タップで FloatingEditor 起動。 */
function EmptyLineItem({ isEditing, onTap }: EmptyLineItemProps) {
  const bgClass = isEditing ? "bg-yellow-50" : "";
  return (
    <li className={`flex items-stretch min-h-11 rounded ${bgClass}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          tapFeedback();
          onTap();
        }}
        aria-label="未入力の行（タップで入力）"
        className="flex items-stretch min-h-11 w-full cursor-text bg-transparent text-left"
      >
        <span
          aria-hidden="true"
          className="w-11 flex items-center justify-center text-yellow-300 text-lg shrink-0"
        >
          ★
        </span>
        <span className="flex-1 min-w-0 self-center text-neutral-300 text-sm pl-1">未入力の行</span>
      </button>
    </li>
  );
}

type LineItemProps = {
  text: string;
  done: boolean;
  favorite: boolean;
  /** 買い物マーカー（行ごと、妻の手動視覚マーキング） */
  cart: boolean;
  /** 長押しメニューモード（旧称: 削除モード）か。true の間は ↑+/↓+/✕ を表示＋行を揺らす。 */
  wobble: boolean;
  /** この行が FloatingEditor で編集中か（薄い背景色ハイライト） */
  isEditing: boolean;
  /** wobble 中の外タップ判定用に親が渡す `<li>` 参照（wobble=false のときは未指定） */
  rowRef?: React.Ref<HTMLLIElement>;
  onToggle: () => void;
  onToggleFavorite: () => void;
  onToggleCart: () => void;
  /** 料理名エリアのタップ。短押し時のみ。長押し時は onLongPress が代わりに発火する */
  onTap: () => void;
  /** 料理名エリアを長押しされたとき。親は対応行を wobble 状態に遷移させる。 */
  onLongPress: () => void;
  onRequestDelete: () => void;
  /** F013: この行の直上に空行を挿入してフロート編集を起動する */
  onInsertAbove: () => void;
  /** F013: この行の直下に空行を挿入してフロート編集を起動する */
  onInsertBelow: () => void;
};

/**
 * 1品の表示＋トグル/お気に入り/削除ボタン。
 *
 * 調理中操作の最適化（SPEC「完了トグル（品単位）」改訂）：
 * - ヒット領域：トグル/お気に入り/削除ともに 44×44px（iOS HIG 下限）
 * - 視覚フィードバック：文字色グレー + チェックボックスのグレー塗り
 * - 料理名は 1 行に自動縮小（MemoField と同じ `useAutoShrink`）
 * - タップ時 `tapFeedback()`（対応端末のみ、非対応は no-op）
 * - 300ms 以内の連続タップは 1 回として扱う（チャタリング防止）
 *
 * 編集導線（F011 移行後）：
 * - 料理名エリアの短押し（タップ）→ onTap → 親が FloatingEditor を起動
 * - 料理名エリアの長押し（500ms）→ onLongPress → 削除モード（wobble）
 * - 長押し成立後の click は内部 flag で抑止（onTap が誤発火しないようにする）
 */
function LineItem({
  text,
  done,
  favorite,
  cart,
  wobble,
  isEditing,
  rowRef,
  onToggle,
  onToggleFavorite,
  onToggleCart,
  onTap,
  onLongPress,
  onRequestDelete,
  onInsertAbove,
  onInsertBelow,
}: LineItemProps) {
  const handleToggle = useDebouncedTap((e: React.MouseEvent) => {
    e.stopPropagation();
    tapFeedback();
    onToggle();
  });
  const handleFavorite = useDebouncedTap((e: React.MouseEvent) => {
    e.stopPropagation();
    tapFeedback();
    onToggleFavorite();
  });
  const handleCart = useDebouncedTap((e: React.MouseEvent) => {
    e.stopPropagation();
    tapFeedback();
    onToggleCart();
  });
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    tapFeedback();
    onRequestDelete();
  };

  // 長押し成立時に立てるフラグ。直後の click を onTap から抑止する用途。
  const wasLongPressRef = useRef(false);
  const lp = useLongPress(() => {
    wasLongPressRef.current = true;
    tapFeedback();
    onLongPress();
  });

  const DISH_BASE_PX = 16;
  const { containerRef, measureRef, fontPx } = useAutoShrink({
    value: text,
    basePx: DISH_BASE_PX,
    minPx: 10,
  });

  const textClass = done ? "text-neutral-400" : "text-neutral-800";
  const checkboxClass = done
    ? "bg-neutral-400 border-neutral-400 text-white"
    : "border-neutral-300 bg-white";
  const editingBg = isEditing ? "bg-yellow-50" : "";
  const liClass = `flex items-stretch min-h-11 rounded ${editingBg} ${wobble ? "animate-row-wobble" : ""}`;

  return (
    <li ref={rowRef} className={liClass}>
      <button
        type="button"
        onClick={handleToggle}
        className="w-11 flex items-center justify-center shrink-0"
        aria-label={done ? "未完了に戻す" : "完了にする"}
        aria-pressed={done}
      >
        <span
          className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs ${checkboxClass}`}
        >
          {done ? "✓" : ""}
        </span>
      </button>
      {/* 料理名エリア：短押しで onTap（FloatingEditor 起動）、長押しで onLongPress（削除モード進入） */}
      <div
        ref={containerRef}
        // biome-ignore lint/a11y/useSemanticElements: 既存 LineItem 内の button 群とのネスト回避で div + role=button を採用
        role="button"
        tabIndex={0}
        aria-label={`${text}（タップで編集、長押しで削除モード）`}
        className="flex-1 min-w-0 self-center relative overflow-hidden cursor-text"
        onMouseDown={(e) => {
          // 押下開始ごとにフラグをリセット（前回の長押し成立フラグが残っているケースを潰す）
          wasLongPressRef.current = false;
          lp.onMouseDown();
          // touch 経由でない場合のみここを通る
          void e;
        }}
        onMouseUp={lp.onMouseUp}
        onMouseLeave={lp.onMouseLeave}
        onTouchStart={(e) => {
          wasLongPressRef.current = false;
          lp.onTouchStart();
          void e;
        }}
        onTouchEnd={lp.onTouchEnd}
        onTouchCancel={lp.onTouchCancel}
        onClick={(e) => {
          // 長押し成立後の click は抑止（onTap 誤発火を防ぐ）
          if (wasLongPressRef.current) {
            wasLongPressRef.current = false;
            e.stopPropagation();
            return;
          }
          onTap();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onTap();
          }
        }}
      >
        {/* 計測用：BASE_PX で描画したときの自然幅を得るための非表示要素 */}
        <span
          ref={measureRef}
          aria-hidden="true"
          className="invisible absolute top-0 left-0 whitespace-nowrap"
          style={{ fontSize: `${DISH_BASE_PX}px` }}
        >
          {text}
        </span>
        <span
          style={{ fontSize: `${fontPx}px` }}
          className={`block whitespace-nowrap overflow-hidden leading-7 ${textClass}`}
        >
          {text}
        </span>
      </div>
      {/* wobble 中は ↑+/↓+/✕ を表示し、🛒/♡ は隠す（F013 行間挿入仕様） */}
      {wobble ? (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              tapFeedback();
              onInsertAbove();
            }}
            className="w-11 h-11 flex items-center justify-center shrink-0 text-neutral-400 active:text-blue-500 text-base"
            aria-label={`${text} の上に行を追加`}
          >
            ↑＋
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              tapFeedback();
              onInsertBelow();
            }}
            className="w-11 h-11 flex items-center justify-center shrink-0 text-neutral-400 active:text-blue-500 text-base"
            aria-label={`${text} の下に行を追加`}
          >
            ↓＋
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="w-11 h-11 flex items-center justify-center shrink-0 text-neutral-300 active:text-red-500 text-lg"
            aria-label={`${text} を削除`}
          >
            ✕
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={handleCart}
            className="w-11 h-11 flex items-center justify-center shrink-0"
            aria-label={cart ? "買い物マーク解除" : "買い物マークを付ける"}
            aria-pressed={cart}
          >
            {cart ? (
              <img src={cartImg} alt="" aria-hidden="true" className="w-10 h-10" />
            ) : (
              <span className="w-5 h-5 text-base leading-none opacity-30">🛒</span>
            )}
          </button>
          <button
            type="button"
            onClick={handleFavorite}
            className="w-11 h-11 flex items-center justify-center shrink-0"
            aria-label={favorite ? "お気に入り解除" : "お気に入りに追加"}
            aria-pressed={favorite}
          >
            {favorite ? (
              <img src={favoriteImg} alt="" aria-hidden="true" className="w-10 h-10" />
            ) : (
              <span className="w-5 h-5 text-neutral-300 text-base leading-none">♡</span>
            )}
          </button>
        </>
      )}
    </li>
  );
}

type ConfirmDeleteDialogProps = {
  text: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * 行削除の確認ポップアップ。
 * - 画面中央にオーバーレイ表示
 * - 背景（overlay）タップで Cancel
 * - Escape キーで Cancel
 * - 「削除」ボタンで Confirm
 */
function ConfirmDeleteDialog({ text, onConfirm, onCancel }: ConfirmDeleteDialogProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      onClick={onCancel}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
      role="presentation"
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center"
    >
      <div
        // ダイアログ内部のタップは外側へ伝播させない（背景タップキャンセルを発火させない）
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        // biome-ignore lint/a11y/useSemanticElements: <dialog> のネイティブ close 挙動と干渉するためカスタム実装
        role="dialog"
        aria-modal="true"
        aria-label="行を削除"
        className="bg-white rounded-lg shadow-xl px-6 py-5 w-72 max-w-[85%]"
      >
        <p className="text-sm text-neutral-700 mb-4 break-words">
          <span className="font-medium">{text}</span> を削除しますか？
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 min-h-11 text-sm text-neutral-600 rounded"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 min-h-11 text-sm text-white bg-red-500 rounded active:bg-red-600"
          >
            削除
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 連続タップ（既定 300ms 以内）を 1 回として扱う簡易デバウンサ。
 * シングルタップは即時実行される（先頭タップを通し、ロック解除までの後続を捨てる）。
 */
function useDebouncedTap(
  handler: (e: React.MouseEvent) => void,
  ms = 300,
): (e: React.MouseEvent) => void {
  const lockedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );
  return useCallback(
    (e: React.MouseEvent) => {
      if (lockedRef.current) return;
      lockedRef.current = true;
      timerRef.current = setTimeout(() => {
        lockedRef.current = false;
        timerRef.current = null;
      }, ms);
      handlerRef.current(e);
    },
    [ms],
  );
}

/**
 * 祝日名のラベル。日付列幅（96px）に収まらない長さでも 1 行表示を維持するため、
 * `useAutoShrink` でフォントサイズを動的縮小する。
 */
function HolidayLabel({ name }: { name: string }) {
  const BASE_PX = 12;
  const { containerRef, measureRef, fontPx } = useAutoShrink({
    value: name,
    basePx: BASE_PX,
    minPx: 8,
  });
  return (
    <div ref={containerRef} className="relative w-full overflow-hidden mt-0.5">
      <span
        ref={measureRef}
        aria-hidden="true"
        className="invisible absolute top-0 left-0 whitespace-nowrap"
        style={{ fontSize: `${BASE_PX}px` }}
      >
        {name}
      </span>
      <div
        style={{ fontSize: `${fontPx}px` }}
        className="text-red-500 leading-tight whitespace-nowrap overflow-hidden"
      >
        {name}
      </div>
    </div>
  );
}

type MemoFieldProps = {
  dateKey: DateKey;
  value: string;
  isEditing: boolean;
  onRequestEdit: () => void;
};

/**
 * ちょいメモ欄（表示専用、F011 移行後）。
 *
 * - 編集は FloatingEditor 経由（タップで `onRequestEdit` を親に通知）
 * - 表示は 1 行に動的縮小（`useAutoShrink`）
 * - 空のときはプレースホルダ「メモ」を薄い色で表示
 * - 編集中はハイライト（bg-yellow-50）
 */
function MemoField({ dateKey, value, isEditing, onRequestEdit }: MemoFieldProps) {
  const BASE_PX = 14;
  const { containerRef, measureRef, fontPx } = useAutoShrink({
    value,
    basePx: BASE_PX,
    minPx: 8,
    emptyPx: 10,
  });

  const isEmpty = value === "";
  const editingBg = isEditing ? "bg-yellow-50" : "";

  return (
    <div
      ref={containerRef}
      className={`mt-0.5 relative w-full overflow-hidden cursor-text rounded ${editingBg}`}
      onClick={(e) => {
        e.stopPropagation();
        onRequestEdit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onRequestEdit();
        }
      }}
      // biome-ignore lint/a11y/useSemanticElements: button ネスト回避と既存の領域分離パターンに揃える
      role="button"
      tabIndex={0}
      aria-label={`${formatDayLabel(dateKey)} のメモ${isEmpty ? "（未入力）" : ""}`}
    >
      <span
        ref={measureRef}
        aria-hidden="true"
        className="invisible absolute top-0 left-0 whitespace-pre italic"
        style={{ fontSize: `${BASE_PX}px` }}
      >
        {value || " "}
      </span>
      <div
        style={{ fontSize: `${fontPx}px` }}
        className={`leading-tight whitespace-nowrap overflow-hidden ${
          isEmpty ? "text-neutral-300 not-italic" : "text-neutral-500 italic"
        }`}
      >
        {value || "メモ"}
      </div>
    </div>
  );
}
