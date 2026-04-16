import { useCallback, useEffect, useRef, useState } from "react";
import emptyDayImg from "../assets/empty-day.png";
import favoriteImg from "../assets/favorite.png";
import { formatDayLabel, isSaturday, isSunday } from "../lib/date";
import { tapFeedback } from "../lib/haptics";
import type { DateKey, DayMeals } from "../types";

type Props = {
  dateKey: DateKey;
  day: DayMeals | undefined;
  isToday: boolean;
  /** 未来の空日ウィンドウに含まれる日か（SPEC「空状態の応援表示」） */
  showCheer: boolean;
  /**
   * 可視範囲付近の日付か（SPEC「フリー入力 / 編集モードの扱い」）。
   * true なら textarea を常時マウントしてタップなしで入力可能にする。
   * false なら遠方として「タップで編集モード進入」方式を維持する。
   */
  alwaysEditable: boolean;
  onTextChange: (text: string) => void;
  onToggleLine: (lineIndex: number) => void;
  onToggleFavorite: (lineIndex: number) => void;
};

export function DayRow({
  dateKey,
  day,
  isToday,
  showCheer,
  alwaysEditable,
  onTextChange,
  onToggleLine,
  onToggleFavorite,
}: Props) {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lines = day?.lines ?? [];
  const rawText = lines.map((l) => l.text).join("\n");

  // 編集モード進入時：フォーカスとカーソルを末尾に
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
      autoResize(textareaRef.current);
    }
  }, [editing]);

  // 常時 textarea モード：マウント・切替時に高さを合わせる
  useEffect(() => {
    if (alwaysEditable && textareaRef.current) {
      autoResize(textareaRef.current);
    }
  }, [alwaysEditable]);

  const labelColor = isSunday(dateKey)
    ? "text-red-500"
    : isSaturday(dateKey)
      ? "text-blue-500"
      : "text-neutral-700";

  const bgClass = isToday ? "bg-yellow-50" : "bg-white";
  const isEmptyDay = lines.length === 0 || (lines.length === 1 && lines[0]?.text === "");
  const visibleLines = lines
    .map((line, idx) => ({ line, idx }))
    .filter(({ line }) => line.text !== "");

  // ── 常時 textarea モード（可視範囲付近の日付） ───────────────
  if (alwaysEditable) {
    return (
      <div className={`flex gap-3 px-3 py-2 border-b border-neutral-100 ${bgClass}`}>
        <div className="w-24 shrink-0">
          <div className={`text-sm font-medium ${labelColor}`}>{formatDayLabel(dateKey)}</div>
          {isToday && <div className="text-xs text-yellow-700 mt-0.5">今日</div>}
        </div>
        <div className="flex-1 min-w-0">
          <textarea
            key={dateKey}
            ref={textareaRef}
            defaultValue={rawText}
            onChange={(e) => {
              onTextChange(e.target.value);
              autoResize(e.target);
            }}
            placeholder={isEmptyDay ? "献立を入力" : undefined}
            className="w-full resize-none bg-transparent outline-none text-base leading-7 min-h-7 placeholder:text-neutral-300"
            rows={Math.max(1, lines.length)}
            aria-label={`${formatDayLabel(dateKey)} の献立を入力`}
          />
          {isEmptyDay && showCheer && (
            <img
              src={emptyDayImg}
              alt=""
              aria-hidden="true"
              className="w-10 h-10 opacity-80 animate-cheer-flip"
            />
          )}
          {visibleLines.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {visibleLines.map(({ line, idx }) => (
                <LineItem
                  key={`${dateKey}-${idx}`}
                  text={line.text}
                  done={line.done}
                  favorite={line.favorite ?? false}
                  fullWidthToggle
                  onToggle={() => onToggleLine(idx)}
                  onToggleFavorite={() => onToggleFavorite(idx)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  // ── タップ進入モード（遠方日付：DOM コスト抑制） ──────────────
  return (
    <div className={`flex gap-3 px-3 py-2 border-b border-neutral-100 ${bgClass}`}>
      <div className="w-24 shrink-0">
        <div className={`text-sm font-medium ${labelColor}`}>{formatDayLabel(dateKey)}</div>
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
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full text-left min-h-11 py-1"
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
                {visibleLines.map(({ line, idx }) => (
                  <LineItem
                    key={`${dateKey}-${idx}`}
                    text={line.text}
                    done={line.done}
                    favorite={line.favorite ?? false}
                    onToggle={() => onToggleLine(idx)}
                    onToggleFavorite={() => onToggleFavorite(idx)}
                  />
                ))}
              </ul>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

type LineItemProps = {
  text: string;
  done: boolean;
  favorite: boolean;
  /** トグル領域を「行全体の左 1/3 以上」に拡張する（常時 textarea モード用） */
  fullWidthToggle?: boolean;
  onToggle: () => void;
  onToggleFavorite: () => void;
};

/**
 * 1品の表示＋トグル/お気に入りボタン。
 *
 * 調理中操作の最適化（SPEC「完了トグル」改訂）：
 * - 視覚フィードバックは 3 点併用：打ち消し線 + 文字色グレー + 行背景色変化
 * - チャタリング防止：300ms 以内の連続タップは 1 回として扱う
 * - 触覚フィードバック発火（対応端末のみ）
 * - fullWidthToggle=true ではタップ領域を行左 1/3 以上に拡張
 */
function LineItem({
  text,
  done,
  favorite,
  fullWidthToggle,
  onToggle,
  onToggleFavorite,
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

  // 視覚フィードバック 3 点併用：打ち消し線 + 文字色 + 行背景色
  const textClass = done ? "line-through text-neutral-400" : "text-neutral-800";
  const rowBgClass = done ? "bg-green-50" : "";
  const checkboxClass = done
    ? "bg-green-500 border-green-500 text-white"
    : "border-neutral-300 bg-white";

  if (fullWidthToggle) {
    // タップ領域を行左 1/3 以上に拡張するため、トグルボタンを flex-1 で広げる。
    // 行全体は <li>（非ボタン）で、トグルボタン・お気に入りボタンが個別に並ぶ。
    return (
      <li className={`flex items-stretch min-h-11 rounded ${rowBgClass}`}>
        <button
          type="button"
          onClick={handleToggle}
          className="flex-1 flex items-center gap-2 text-left px-1 min-h-11"
          aria-label={done ? "未完了に戻す" : "完了にする"}
          aria-pressed={done}
        >
          <span
            className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs shrink-0 ${checkboxClass}`}
          >
            {done ? "✓" : ""}
          </span>
          <span className={`flex-1 text-base leading-7 break-words ${textClass}`}>{text}</span>
        </button>
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
      </li>
    );
  }

  // タップ進入モードの行：親が「タップで編集」なので、トグルは行頭の小さなボタン。
  // ヒット領域は w-11 h-11（44px）+ -ml-1 のはみ出しで実質的に行左域を覆う。
  return (
    <li className={`flex items-start gap-2 py-0.5 rounded ${rowBgClass}`}>
      <button
        type="button"
        onClick={handleToggle}
        className="w-11 h-11 -my-2 -ml-1 flex items-center justify-center shrink-0"
        aria-label={done ? "未完了に戻す" : "完了にする"}
        aria-pressed={done}
      >
        <span
          className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs ${checkboxClass}`}
        >
          {done ? "✓" : ""}
        </span>
      </button>
      <span className={`flex-1 pt-2 text-base leading-7 break-words ${textClass}`}>{text}</span>
      <button
        type="button"
        onClick={handleFavorite}
        className="w-11 h-11 -my-2 -mr-1 flex items-center justify-center shrink-0"
        aria-label={favorite ? "お気に入り解除" : "お気に入りに追加"}
        aria-pressed={favorite}
      >
        {favorite ? (
          <img src={favoriteImg} alt="" aria-hidden="true" className="w-6 h-6" />
        ) : (
          <span className="w-5 h-5 text-neutral-300 text-base leading-none">♡</span>
        )}
      </button>
    </li>
  );
}

/**
 * 連続タップ（既定 300ms 以内）を 1 回として扱う簡易デバウンサ。
 * シングルタップは即時実行される（先頭タップを通し、後続を捨てる）。
 */
function useDebouncedTap(
  handler: (e: React.MouseEvent) => void,
  ms = 300,
): (e: React.MouseEvent) => void {
  const lastRef = useRef(0);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  return useCallback(
    (e: React.MouseEvent) => {
      const now = Date.now();
      if (now - lastRef.current < ms) return;
      lastRef.current = now;
      handlerRef.current(e);
    },
    [ms],
  );
}

function autoResize(el: HTMLTextAreaElement): void {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}
