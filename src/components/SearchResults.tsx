import emptySearchImg from "../assets/empty-search.png";
import { formatDayLabel } from "../lib/date";
import type { SearchHit } from "../types";

type Props = {
  hits: SearchHit[];
  query: string;
  onPick: (date: string) => void;
};

export function SearchResults({ hits, query, onPick }: Props) {
  if (query.trim() === "") return null;
  return (
    <div className="absolute inset-x-0 top-full bg-white border-b border-neutral-200 shadow-md max-h-[70vh] overflow-y-auto z-20">
      {hits.length === 0 ? (
        <div className="px-4 py-6 text-center text-neutral-400 text-sm flex flex-col items-center">
          <img
            src={emptySearchImg}
            alt=""
            aria-hidden="true"
            className="w-32 h-32 opacity-90 mb-2"
          />
          <span>一致する履歴はありません</span>
        </div>
      ) : (
        <ul>
          {hits.map((hit) => (
            <li key={hit.date}>
              <button
                type="button"
                onClick={() => onPick(hit.date)}
                className="w-full text-left px-4 py-3 border-b border-neutral-100 active:bg-neutral-100 min-h-11"
              >
                <div className="flex items-center gap-2 text-sm text-neutral-600 mb-1">
                  <span>{formatDayLabel(hit.date)}</span>
                  {hit.matchKind === "similar" && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      類似
                    </span>
                  )}
                </div>
                <div className="text-sm text-neutral-800 whitespace-pre-wrap">
                  {hit.lines
                    .map((l) => l.text)
                    .filter((t) => t !== "")
                    .join("\n")}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
