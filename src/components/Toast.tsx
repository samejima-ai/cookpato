/**
 * 画面下部の通知トースト（F007 クリップボードコピー成功 / 失敗の通知）。
 *
 * SPEC §「エクスポート UI（コピー）」より：
 * - 表示時間 3 秒、自動消去
 * - pointer-events: none で操作を妨げない
 * - prefers-reduced-motion でフェードを無効化（CSS 側の @media クエリで処理）
 * - CLAUDE.md「アニメは 100-200ms 以内」規約の例外（narrative animation 枠、読了時間確保）
 *
 * a11y: `kind` が error のときは `role="alert"`（assertive 読み上げ）、
 * それ以外は `<output>` 既定の `role="status"` + `aria-live="polite"` を維持する。
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
  // 連続コピーで後発トーストが即消えないように、親から `key` を変えて
  // 再マウントする運用（App.tsx 参照）。本コンポーネント側のタイマーは
  // `onDismiss` の参照のみに依存し、message/kind は表示のみに使う。
  useEffect(() => {
    const t = window.setTimeout(onDismiss, TOAST_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [onDismiss]);

  const colorClass = kind === "error" ? "bg-red-600 text-white" : "bg-neutral-800 text-white";
  const commonClass = `mb-4 mx-4 px-4 py-2 rounded-lg shadow-lg text-sm max-w-md text-center animate-toast-fade ${colorClass}`;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center safe-bottom">
      {kind === "error" ? (
        <div role="alert" aria-live="assertive" className={commonClass}>
          {message}
        </div>
      ) : (
        <output aria-live="polite" className={commonClass}>
          {message}
        </output>
      )}
    </div>
  );
}
