import type { ChangeEvent } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  /** 編集中 DayRow のアクティブ行に対する過去ヒット件数（検索欄が空のときのみ意味を持つ） */
  activeCount?: number;
  /** これ以上は「N+」と省略表示する件数上限 */
  activeCountCap?: number;
  /** 件数バッジタップ。検索欄へクエリを流し込み結果パネルを開くのに使う */
  onActiveCountTap?: () => void;
};

export function SearchBar({
  value,
  onChange,
  activeCount = 0,
  activeCountCap = 20,
  onActiveCountTap,
}: Props) {
  function handle(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
  }
  // 検索欄が空 かつ 件数 > 0 のときだけバッジを出す（結果パネルとの重複回避）
  const showBadge = value === "" && activeCount > 0;
  const badgeLabel = activeCount > activeCountCap ? `${activeCountCap}+` : `${activeCount}`;
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-neutral-200">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5 text-neutral-400 shrink-0"
        aria-hidden="true"
      >
        <title>検索</title>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={handle}
        placeholder="過去の献立を検索"
        className="flex-1 bg-transparent outline-none text-base placeholder:text-neutral-400"
        enterKeyHint="search"
      />
      {showBadge && (
        <button
          type="button"
          onClick={onActiveCountTap}
          aria-label={`過去の類似ヒット ${badgeLabel} 件を表示`}
          // ヘッダー高さ（input と py-2 で決まる ~40px）を超えないサイズに抑える
          // 現状の clear-button は min-h-11 のままなのでそのボタンがある場合は高さが
          // 変わるが、このバッジ単独表示時（検索欄が空のとき）は高さが変化しない。
          className="shrink-0 h-6 px-2 rounded-full bg-amber-50 border border-amber-200 text-xs font-medium text-amber-700 tabular-nums flex items-center"
        >
          {badgeLabel}
        </button>
      )}
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-neutral-400 text-sm px-2 py-1 min-w-11 min-h-11 flex items-center justify-center"
          aria-label="検索をクリア"
        >
          ✕
        </button>
      )}
    </div>
  );
}
