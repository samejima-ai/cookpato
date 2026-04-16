import { useState } from "react";
import type { AppDataApi } from "../hooks/useAppData";

type Props = {
  api: AppDataApi;
};

export function StockList({ api }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [draft, setDraft] = useState("");

  function handleAdd() {
    if (draft.trim() === "") return;
    api.addStock(draft);
    setDraft("");
  }

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
          <ul className="space-y-1 mb-2">
            {api.data.stock.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 bg-white rounded px-2 py-1 border border-neutral-200"
              >
                <button
                  type="button"
                  onClick={() => api.removeStock(item.id)}
                  className="w-10 h-10 flex items-center justify-center text-neutral-400 active:text-red-500"
                  aria-label={`${item.text} を削除`}
                >
                  ×
                </button>
                <span className="flex-1 text-sm text-neutral-800 break-words">{item.text}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder="ストックを追加"
              className="flex-1 text-sm px-2 py-2 rounded border border-neutral-200 bg-white outline-none focus:border-neutral-400 min-h-11"
            />
            <button
              type="button"
              onClick={handleAdd}
              className="px-4 py-2 rounded bg-neutral-800 text-white text-sm min-h-11 min-w-11 disabled:opacity-50"
              disabled={draft.trim() === ""}
            >
              追加
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
