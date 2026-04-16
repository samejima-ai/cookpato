import type { ChangeEvent } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
};

export function SearchBar({ value, onChange }: Props) {
  function handle(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
  }
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
