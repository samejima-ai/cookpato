import { useCallback, useEffect, useRef, useState } from "react";
import emptyDayImg from "../assets/empty-day.png";
import favoriteImg from "../assets/favorite.png";
import { useAutoShrink } from "../hooks/useAutoShrink";
import { useComposition } from "../hooks/useComposition";
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
  /** お気に入り判定用の正規化済みキー集合 */
  favoriteKeys: Set<string>;
  onTextChange: (text: string) => void;
  onToggleLine: (lineIndex: number) => void;
  onToggleFavorite: (lineIndex: number) => void;
  onDeleteLine: (lineIndex: number) => void;
  /** ちょいメモ（料理行とは別枠）の更新 */
  onMemoChange: (text: string) => void;
  /**
   * 編集中のカーソル行テキストと、その行が属する日付を親に通知する。
   * 編集開始時にも呼び、編集終了（blur）時は空文字で呼ぶ。
   * アクティブ行の類似検索件数をヘッダーに出すためのフック。
   * 日付は「自分自身を検索対象から除外する」ために使う。
   */
  onActiveQueryChange?: (text: string, date: DateKey) => void;
  /** 編集モード進入時に呼ばれる。週達成判定の baseline スナップショットを取るため。 */
  onBeginEdit?: () => void;
  /** textarea blur 時に呼ばれる。週達成（未達成→達成）遷移を確定する。 */
  onCommitEdit?: () => void;
};

export function DayRow({
  dateKey,
  day,
  isToday,
  showCheer,
  favoriteKeys,
  onTextChange,
  onToggleLine,
  onToggleFavorite,
  onDeleteLine,
  onMemoChange,
  onActiveQueryChange,
  onBeginEdit,
  onCommitEdit,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  // 行削除モード（長押しで突入）中の対象行 index。null は非アクティブ。
  // 同時に揺れる行は高々 1 本（iOS のぷるぷるモード相当）。
  const [wobbleIndex, setWobbleIndex] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const wobbleRowRef = useRef<HTMLLIElement | null>(null);
  const ime = useComposition();
  const lines = day?.lines ?? [];
  const rawText = lines.map((l) => l.text).join("\n");

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
      autoResize(textareaRef.current);
      // 編集進入時点のカーソル行を通知
      onActiveQueryChange?.(caretLine(textareaRef.current.value, len), dateKey);
      // 週達成判定の baseline スナップショットを親に取らせる
      onBeginEdit?.();
    }
  }, [editing, onActiveQueryChange, onBeginEdit, dateKey]);

  // 編集終了時にアクティブクエリをクリア
  useEffect(() => {
    if (!editing) onActiveQueryChange?.("", dateKey);
  }, [editing, onActiveQueryChange, dateKey]);

  // 編集モードに入ったら wobble は解除（重複表示の回避）
  useEffect(() => {
    if (editing) setWobbleIndex(null);
  }, [editing]);

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

  function emitActiveLine(el: HTMLTextAreaElement): void {
    if (!onActiveQueryChange) return;
    const caret = el.selectionStart ?? el.value.length;
    onActiveQueryChange(caretLine(el.value, caret), dateKey);
  }

  const holidayName = getHolidayName(dateKey);
  const labelColor =
    holidayName || isSunday(dateKey)
      ? "text-red-500"
      : isSaturday(dateKey)
        ? "text-blue-500"
        : "text-neutral-700";

  const bgClass = isToday ? "bg-yellow-50" : "bg-white";
  const isEmptyDay = lines.length === 0 || (lines.length === 1 && lines[0]?.text === "");

  const pendingText = pendingDelete !== null ? (lines[pendingDelete]?.text ?? "") : "";

  return (
    <div className={`flex gap-3 px-3 py-2 border-b border-neutral-100 ${bgClass}`}>
      <div className="w-24 shrink-0">
        <div className={`text-sm font-medium ${labelColor}`}>
          <span>{formatDayLabel(dateKey)}</span>
        </div>
        {holidayName && (
          <div className="text-xs text-red-500 mt-0.5 leading-tight">{holidayName}</div>
        )}
        {isToday && <div className="text-xs text-yellow-700 mt-0.5">今日</div>}
        <MemoField dateKey={dateKey} value={day?.memo ?? ""} onChange={onMemoChange} />
      </div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <textarea
            ref={textareaRef}
            defaultValue={rawText}
            onCompositionStart={ime.onCompositionStart}
            onCompositionEnd={(e) => {
              ime.onCompositionEnd();
              // compositionEnd の最終確定値を明示反映する（iOS Safari では
              // compositionEnd 後の onChange が発火しない経路があるため）。
              // 他ブラウザでは直後に同値の onChange が続くため markCommitted で 1 回抑止する。
              const committed = e.currentTarget.value;
              ime.markCommitted(committed);
              onTextChange(committed);
              autoResize(e.currentTarget);
              emitActiveLine(e.currentTarget);
            }}
            onChange={(e) => {
              if (ime.shouldSkipChange(e.target.value, e.nativeEvent)) return;
              onTextChange(e.target.value);
              autoResize(e.target);
              emitActiveLine(e.target);
            }}
            onSelect={(e) => emitActiveLine(e.currentTarget)}
            onKeyUp={(e) => emitActiveLine(e.currentTarget)}
            onClick={(e) => emitActiveLine(e.currentTarget)}
            onBlur={() => {
              setEditing(false);
              onCommitEdit?.();
            }}
            className="w-full resize-none bg-transparent outline-none text-base leading-7 min-h-7"
            rows={Math.max(1, lines.length)}
            aria-label={`${formatDayLabel(dateKey)} の献立を編集`}
          />
        ) : (
          // 外側は LineItem 内のトグル/お気に入り/削除ボタンを内包するため <button> ではなく
          // <div> を使う。button 入れ子は HTML 的に無効で、アクセシビリティツリーが崩れるため。
          // テキスト領域タップで編集モード進入、ボタン側は stopPropagation で分離する。
          // 内部にトグル/お気に入り/削除ボタンを含むため <button> ネスト回避で <div role="button"> を採用
          <div
            onClick={() => setEditing(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setEditing(true);
            }}
            className="w-full min-h-11 py-1 cursor-text"
            // biome-ignore lint/a11y/useSemanticElements: <button> ネスト回避
            role="button"
            tabIndex={0}
            aria-label={`${formatDayLabel(dateKey)} の献立を編集`}
          >
            {isEmptyDay ? (
              <span className="flex items-center gap-2">
                <span className="text-neutral-300 text-base">＋</span>
                {showCheer && (
                  <img
                    src={emptyDayImg}
                    alt=""
                    aria-hidden="true"
                    className="w-10 h-10 opacity-80 animate-cheer-flip"
                  />
                )}
              </span>
            ) : (
              <ul>
                {lines.map((line, idx) =>
                  line.text === "" ? null : (
                    <LineItem
                      // biome-ignore lint/suspicious/noArrayIndexKey: 行の並べ替えはせず、追加・削除のみなので index をキーにしてよい（SPEC.md 準拠）
                      key={`${dateKey}-${idx}`}
                      text={line.text}
                      done={line.done}
                      favorite={favoriteKeys.has(favoriteKey(line.text))}
                      wobble={wobbleIndex === idx}
                      rowRef={wobbleIndex === idx ? wobbleRowRef : undefined}
                      onToggle={() => onToggleLine(idx)}
                      onToggleFavorite={() => onToggleFavorite(idx)}
                      onLongPress={() => setWobbleIndex(idx)}
                      onRequestDelete={() => {
                        setWobbleIndex(null);
                        setPendingDelete(idx);
                      }}
                    />
                  ),
                )}
              </ul>
            )}
          </div>
        )}
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

type LineItemProps = {
  text: string;
  done: boolean;
  favorite: boolean;
  /** 削除モード（長押し突入）中か。true の間だけ ✕ ボタンを表示＋行を揺らす。 */
  wobble: boolean;
  /** wobble 中の外タップ判定用に親が渡す `<li>` 参照（wobble=false のときは未指定） */
  rowRef?: React.Ref<HTMLLIElement>;
  onToggle: () => void;
  onToggleFavorite: () => void;
  /** 料理名エリアを長押しされたとき。親は対応行を wobble 状態に遷移させる。 */
  onLongPress: () => void;
  onRequestDelete: () => void;
};

/**
 * 1品の表示＋トグル/お気に入り/削除ボタン。
 *
 * 調理中操作の最適化（SPEC「完了トグル（品単位）」改訂）：
 * - ヒット領域：トグル/お気に入り/削除ともに 44×44px（iOS HIG 下限）
 *   （料理名の表示幅を最大化するため、以前の「行左 1/3 占有」は廃止）
 * - 視覚フィードバック：文字色グレー + チェックボックスのグレー塗り
 *   （完了行は静かに後退させ、未完了行との相対的なコントラストで識別）
 * - 料理名は 1 行に自動縮小（MemoField と同じ `useAutoShrink`）
 * - タップ時 `tapFeedback()`（対応端末のみ、非対応は no-op）
 * - 300ms 以内の連続タップは 1 回として扱う（チャタリング防止）
 *
 * 行削除の UI：
 * - ✕ ボタンは常時非表示（料理名の表示幅を最大化するため）
 * - 料理名エリアを 500ms 長押しすると「削除モード（ぷるぷる）」に入り
 *   ✕ が現れる。以降は従来の確認ダイアログ経由で削除
 * - 削除モード中の外タップ / ESC で通常表示に戻る（親 `DayRow` が制御）
 */
function LineItem({
  text,
  done,
  favorite,
  wobble,
  rowRef,
  onToggle,
  onToggleFavorite,
  onLongPress,
  onRequestDelete,
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
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    tapFeedback();
    onRequestDelete();
  };
  const longPress = useLongPress(() => {
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
  const liClass = `flex items-stretch min-h-11 rounded ${wobble ? "animate-row-wobble" : ""}`;

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
      <div
        ref={containerRef}
        className="flex-1 min-w-0 self-center relative overflow-hidden"
        {...longPress}
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
      <button
        type="button"
        onClick={handleFavorite}
        className="w-11 h-11 flex items-center justify-center shrink-0"
        aria-label={favorite ? "お気に入り解除" : "お気に入りに追加"}
        aria-pressed={favorite}
      >
        {favorite ? (
          <img src={favoriteImg} alt="" aria-hidden="true" className="w-6 h-6" />
        ) : (
          <span className="w-5 h-5 text-neutral-300 text-base leading-none">♡</span>
        )}
      </button>
      {wobble && (
        <button
          type="button"
          onClick={handleDelete}
          className="w-11 h-11 flex items-center justify-center shrink-0 text-neutral-300 active:text-red-500 text-lg"
          aria-label={`${text} を削除`}
        >
          ✕
        </button>
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

function autoResize(el: HTMLTextAreaElement): void {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

/**
 * textarea の value とカーソル位置から、カーソルのある 1 行分のテキストを返す。
 * 行末改行は含めない。空行は空文字を返す。
 */
function caretLine(value: string, caret: number): string {
  const start = value.lastIndexOf("\n", caret - 1) + 1;
  const nextNl = value.indexOf("\n", caret);
  const end = nextNl === -1 ? value.length : nextNl;
  return value.slice(start, end);
}

type MemoFieldProps = {
  dateKey: DateKey;
  value: string;
  onChange: (text: string) => void;
};

/**
 * ちょいメモ欄。料理行とは別枠の短文メモ。
 * - 日付列（w-24 = 96px）内に収める
 * - 実測した自然幅をもとに font-size を動的に縮小し、1 行で全文表示する
 *   （Excel の「縮小して全体を表示」に相当。横スクロールを避ける）
 * - 空のときは小さくプレースホルダ「メモ」のみ
 * - 料理行の編集モードとは領域分離（stopPropagation）
 */
function MemoField({ dateKey, value, onChange }: MemoFieldProps) {
  const BASE_PX = 14;
  const { containerRef, measureRef, fontPx } = useAutoShrink({
    value,
    basePx: BASE_PX,
    minPx: 8,
    emptyPx: 10,
  });
  const ime = useComposition();

  return (
    <div
      ref={containerRef}
      className="mt-0.5 relative w-full overflow-hidden"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {/* 計測用：BASE_PX で描画したときの自然幅を得るための非表示要素。
          レイアウトには影響させないため absolute + invisible。 */}
      <span
        ref={measureRef}
        aria-hidden="true"
        className="invisible absolute top-0 left-0 whitespace-pre italic"
        style={{ fontSize: `${BASE_PX}px` }}
      >
        {value || "\u00A0"}
      </span>
      <input
        type="text"
        value={value}
        onCompositionStart={ime.onCompositionStart}
        onCompositionEnd={(e) => {
          ime.onCompositionEnd();
          const committed = e.currentTarget.value;
          ime.markCommitted(committed);
          onChange(committed);
        }}
        onChange={(e) => {
          if (ime.shouldSkipChange(e.target.value, e.nativeEvent)) return;
          onChange(e.target.value);
        }}
        placeholder="メモ"
        style={{ fontSize: `${fontPx}px` }}
        className="w-full bg-transparent outline-none text-neutral-500 italic placeholder:text-neutral-300 placeholder:not-italic leading-tight py-0"
        aria-label={`${formatDayLabel(dateKey)} のメモ`}
      />
    </div>
  );
}
