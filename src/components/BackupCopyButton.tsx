/**
 * F007 バックアップコピーボタン（SPEC §「エクスポート UI（コピー）」）。
 * ストックリスト折りたたみ内に配置。タップで現 AppData をクリップボードへコピーし、
 * 成功 / 失敗に応じてトーストを発火する。
 */
import type { CopyResult } from "../hooks/useBackup";
import type { ToastKind } from "./Toast";

type Props = {
  onCopy: () => Promise<CopyResult>;
  onToast: (message: string, kind: ToastKind) => void;
};

const SUCCESS_MESSAGE = "コピーしました。Keep メモやメモ帳に貼り付けて保管してください";
const FAIL_MESSAGE = "コピーに失敗しました";

export function BackupCopyButton({ onCopy, onToast }: Props) {
  async function handleClick() {
    const result = await onCopy();
    if (result === "ok") {
      onToast(SUCCESS_MESSAGE, "info");
    } else {
      onToast(FAIL_MESSAGE, "error");
    }
  }

  return (
    <div className="px-1 py-2 text-xs">
      <button
        type="button"
        onClick={handleClick}
        className="text-neutral-500 underline active:text-neutral-800 min-h-11 px-2"
      >
        バックアップをコピー
      </button>
    </div>
  );
}
