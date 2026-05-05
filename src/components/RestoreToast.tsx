/**
 * A 層スナップショットからの自動復元発火時に表示するトースト。
 * - 表示中に 3 秒で自動消滅
 * - ユーザーが ✕ をタップしても閉じる
 */
import { useEffect } from "react";

const AUTO_DISMISS_MS = 3000;

type Props = {
  onDismiss: () => void;
};

export function RestoreToast({ onDismiss }: Props) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [onDismiss]);

  return (
    <output
      aria-live="polite"
      className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border-b border-emerald-200 text-sm text-emerald-900"
    >
      <span className="flex-1 min-w-0 truncate">バックアップから復元しました</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="トーストを閉じる"
        className="w-9 h-9 flex items-center justify-center text-emerald-700 active:text-emerald-900 shrink-0"
      >
        ×
      </button>
    </output>
  );
}
