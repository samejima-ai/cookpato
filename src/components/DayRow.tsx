import { useCallback, useEffect, useRef, useState } from "react";
import emptyDayImg from "../assets/empty-day.png";
import favoriteImg from "../assets/favorite.png";
import weekMedalImg from "../assets/week-medal.png";
import { formatDayLabel, isSaturday, isSunday } from "../lib/date";
import { tapFeedback } from "../lib/haptics";
import { favoriteKey } from "../lib/normalize";
import type { DateKey, DayMeals } from "../types";

type Props = {
  dateKey: DateKey;
  day: DayMeals | undefined;
  isToday: boolean;
  /** 未来の空日ウィンドウに含まれる日か（SPEC「空状態の応援表示」） */
  showCheer: boolean;
  /** 「その週（日〜土）がすべて埋まった」日曜行に常駐マークを出すか */
  showWeekComplete: boolean;
  /** お気に入り判定用の正規化済みキー集合 */
  favoriteKeys: Set<string>;
  onTextChange: (text: string) => void;
  onToggleLine: (lineIndex: number) => void;
  onToggleFavorite: (lineIndex: number) => void;
  onDeleteLine: (lineIndex: number) => void;
};

export function DayRow({
  dateKey,
  day,
  isToday,
  showCheer,
  showWeekComplete,
  favoriteKeys,
  onTextChange,
  onToggleLine,
  onToggleFavorite,
  onDeleteLine,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lines = day?.lines ?? [];
  const rawText = lines.map((l) => l.text).join("\n");

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
      autoResize(textareaRef.current);
    }
  }, [editing]);

  const labelColor = isSunday(dateKey)
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
        <div className={`text-sm font-medium ${labelColor} flex items-center gap-1`}>
          <span>{formatDayLabel(dateKey)}</span>
          {showWeekComplete && isSunday(dateKey) && (
            <img
              src={weekMedalImg}
              alt=""
              aria-hidden="true"
              title="この週の献立が埋まりました"
              className="w-6 h-6 shrink-0"
            />
          )}
        </div>
        {isToday && <div className="text-xs text-yellow-700 mt-0.5">今日</div>}
      </div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <textarea
            ref={textareaRef}
            defaultValue={rawText}
            onChange={(e) => {
              onTextChange(e.target.value);
              autoResize(e.target);
            }}
            onBlur={() => setEditing(false)}
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
                      onToggle={() => onToggleLine(idx)}
                      onToggleFavorite={() => onToggleFavorite(idx)}
                      onRequestDelete={() => setPendingDelete(idx)}
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
  onToggle: () => void;
  onToggleFavorite: () => void;
  onRequestDelete: () => void;
};

/**
 * 1品の表示＋トグル/お気に入り/削除ボタン。
 *
 * 調理中操作の最適化（SPEC「完了トグル（品単位）」改訂）：
 * - ヒット領域：トグルボタンは行左 1/3 以上を占有（min-w-11 で 44px 下限）
 * - 視覚フィードバック 3 点併用：打ち消し線 + 文字色グレー + 行背景色
 * - タップ時 `tapFeedback()`（対応端末のみ、非対応は no-op）
 * - 300ms 以内の連続タップは 1 回として扱う（チャタリング防止）
 */
function LineItem({
  text,
  done,
  favorite,
  onToggle,
  onToggleFavorite,
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

  const textClass = done ? "line-through text-neutral-400" : "text-neutral-800";
  const rowBgClass = done ? "bg-green-50" : "";
  const checkboxClass = done
    ? "bg-green-500 border-green-500 text-white"
    : "border-neutral-300 bg-white";

  return (
    <li className={`flex items-stretch min-h-11 rounded ${rowBgClass}`}>
      <button
        type="button"
        onClick={handleToggle}
        className="w-1/3 min-w-11 flex items-center px-1 shrink-0"
        aria-label={done ? "未完了に戻す" : "完了にする"}
        aria-pressed={done}
      >
        <span
          className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs ${checkboxClass}`}
        >
          {done ? "✓" : ""}
        </span>
      </button>
      <span className={`flex-1 self-center text-base leading-7 break-words ${textClass}`}>
        {text}
      </span>
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
      <button
        type="button"
        onClick={handleDelete}
        className="w-11 h-11 flex items-center justify-center shrink-0 text-neutral-300 active:text-red-500 text-lg"
        aria-label={`${text} を削除`}
      >
        ✕
      </button>
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
