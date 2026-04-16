import { useMemo, useState } from "react";
import emptyStockImg from "../assets/empty-stock.png";
import favoriteImg from "../assets/favorite.png";
import type { AppDataApi } from "../hooks/useAppData";
import { favoriteKey } from "../lib/normalize";

type Props = {
  api: AppDataApi;
};

export function StockList({ api }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [draftName, setDraftName] = useState("");
  const [draftQty, setDraftQty] = useState("");
  const favoriteKeys = useMemo(() => new Set(api.data.favorites), [api.data.favorites]);

  function handleAdd() {
    const name = draftName.trim();
    if (name === "") return;
    const parsed = Number.parseInt(draftQty, 10);
    const qty = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
    api.addStock(name, qty);
    setDraftName("");
    setDraftQty("");
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
          {api.data.stock.length === 0 && (
            <div className="flex flex-col items-center py-3 text-neutral-400">
              <img src={emptyStockImg} alt="" aria-hidden="true" className="w-20 h-20 opacity-90" />
              <span className="text-xs mt-1">まだストックはありません</span>
            </div>
          )}
          <ul className="space-y-1 mb-2">
            {api.data.stock.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-1 bg-white rounded px-2 py-1 border border-neutral-200"
              >
                <button
                  type="button"
                  onClick={() => api.decStock(item.id)}
                  disabled={item.qty === 0}
                  className="w-11 h-11 flex items-center justify-center text-neutral-500 active:text-neutral-800 disabled:opacity-30 text-xl shrink-0"
                  aria-label={`${item.text} を1減らす`}
                >
                  −
                </button>
                {item.qty === 0 ? (
                  <button
                    type="button"
                    onClick={() => api.removeStock(item.id)}
                    className="w-11 h-11 flex items-center justify-center rounded bg-red-500 text-white text-sm font-bold shrink-0"
                    aria-label={`${item.text} を削除`}
                  >
                    0
                  </button>
                ) : (
                  <span
                    className="w-11 h-11 flex items-center justify-center text-sm font-medium text-neutral-800 shrink-0 tabular-nums"
                    aria-label={`個数 ${item.qty}`}
                  >
                    {item.qty}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => api.incStock(item.id)}
                  className="w-11 h-11 flex items-center justify-center text-neutral-500 active:text-neutral-800 text-xl shrink-0"
                  aria-label={`${item.text} を1増やす`}
                >
                  ＋
                </button>
                <span className="flex-1 text-sm text-neutral-800 break-words pl-1 flex items-center gap-1">
                  <span className="break-words">{item.text}</span>
                  {favoriteKeys.has(favoriteKey(item.text)) && (
                    <img src={favoriteImg} alt="" aria-hidden="true" className="w-8 h-8 shrink-0" />
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex gap-1">
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
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
              disabled={draftName.trim() === ""}
            >
              追加
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
