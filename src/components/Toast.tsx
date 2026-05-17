/**
 * 画面下部の通知トースト（F007 クリップボードコピー成功 / 失敗の通知）。
 *
 * SPEC §「エクスポート UI（コピー）」より：
 * - 表示時間 3 秒、自動消去
 * - pointer-events: none で操作を妨げない
 * - prefers-reduced-motion でフェードを無効化
 * - CLAUDE.md「アニメは 100-200ms 以内」規約の例外（narrative animation 枠、読了時間確保）
 */
import { useEffect } from "react";

export type ToastKind = "info" | "error";

type Props = {
  message: string;
  kind: ToastKind;
  onDismiss: () => void;
};

/** トースト表示時間（ms）。SPEC で 3 秒指定 */
const TOAST_DURATION_MS = 3000;

export function Toast({ message, kind, onDismiss }: Props) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, TOAST_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [onDismiss]);

  const colorClass = kind === "error" ? "bg-red-600 text-white" : "bg-neutral-800 text-white";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center safe-bottom">
      <output
        className={`mb-4 mx-4 px-4 py-2 rounded-lg shadow-lg text-sm max-w-md text-center motion-safe:animate-toast-fade ${colorClass}`}
      >
        {message}
      </output>
    </div>
  );
}
