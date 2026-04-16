import { useEffect, useRef, useState } from "react";
import { formatDayLabel, isSaturday, isSunday } from "../lib/date";
import type { DateKey, DayMeals } from "../types";

type Props = {
  dateKey: DateKey;
  day: DayMeals | undefined;
  isToday: boolean;
  onTextChange: (text: string) => void;
  onToggleLine: (lineIndex: number) => void;
};

export function DayRow({ dateKey, day, isToday, onTextChange, onToggleLine }: Props) {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lines = day?.lines ?? [];
  const rawText = lines.map((l) => l.text).join("\n");

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      // カーソルを末尾に
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
            {lines.length === 0 || (lines.length === 1 && lines[0]?.text === "") ? (
              <span className="text-neutral-300 text-base">＋</span>
            ) : (
              <ul>
                {lines.map((line, idx) =>
                  line.text === "" ? null : (
                    <LineItem
                      // biome-ignore lint/suspicious/noArrayIndexKey: 行の並べ替えはせず、追加・削除のみなので index をキーにしてよい（SPEC.md 準拠）
                      key={`${dateKey}-${idx}`}
                      text={line.text}
                      done={line.done}
                      onToggle={(e) => {
                        e.stopPropagation();
                        onToggleLine(idx);
                      }}
                    />
                  ),
                )}
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
  onToggle: (e: React.MouseEvent) => void;
};

function LineItem({ text, done, onToggle }: LineItemProps) {
  return (
    <li className="flex items-start gap-2 py-0.5">
      <button
        type="button"
        onClick={onToggle}
        className="w-11 h-11 -my-2 -ml-1 flex items-center justify-center shrink-0"
        aria-label={done ? "未完了に戻す" : "完了にする"}
        aria-pressed={done}
      >
        <span
          className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs ${
            done ? "bg-green-500 border-green-500 text-white" : "border-neutral-300 bg-white"
          }`}
        >
          {done ? "✓" : ""}
        </span>
      </button>
      <span
        className={`pt-2 text-base leading-7 break-words ${
          done ? "line-through text-neutral-400" : "text-neutral-800"
        }`}
      >
        {text}
      </span>
    </li>
  );
}

function autoResize(el: HTMLTextAreaElement): void {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}
