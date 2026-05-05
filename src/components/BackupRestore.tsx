/**
 * バックアップ復元 UI（インポート）。
 * - ボタンタップで `<input type="file">` を起動
 * - ファイル選択 → JSON パース → 確認ダイアログ → 復元実行
 * - 検証失敗時はインラインのエラーメッセージを表示
 *
 * 「現在のデータを上書きします」を必ずダイアログで明示し、誤タップでの全消し事故を防ぐ。
 */
import { useEffect, useRef, useState } from "react";
import type { ImportResult } from "../hooks/useBackup";

type Props = {
  importFromText: (text: string) => ImportResult;
};

export function BackupRestore({ importFromText }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 成功メッセージは 3 秒で自動消滅（再復元時に古い表示が残らないように）
  useEffect(() => {
    if (!successMsg) return;
    const t = window.setTimeout(() => setSuccessMsg(null), 3000);
    return () => window.clearTimeout(t);
  }, [successMsg]);

  function openFileDialog() {
    setError(null);
    inputRef.current?.click();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // 同じファイル再選択を許容するため value をリセット
    e.target.value = "";
    if (!file) return;
    file
      .text()
      .then((text) => {
        setPendingText(text);
      })
      .catch(() => {
        setError("ファイルの読み込みに失敗しました");
      });
  }

  function confirmRestore() {
    if (pendingText === null) return;
    const result = importFromText(pendingText);
    setPendingText(null);
    if (result.ok) {
      setError(null);
      setSuccessMsg("バックアップから復元しました");
    } else {
      setError(result.reason);
    }
  }

  function cancelRestore() {
    setPendingText(null);
  }

  return (
    <div className="px-1 py-2 text-xs">
      <button
        type="button"
        onClick={openFileDialog}
        className="text-neutral-500 underline active:text-neutral-800 min-h-11 px-2"
      >
        バックアップから復元
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFile}
        className="hidden"
      />
      {error && (
        <p role="alert" className="mt-1 text-red-600">
          {error}
        </p>
      )}
      {successMsg && <output className="mt-1 block text-emerald-700">{successMsg}</output>}
      {pendingText !== null && (
        <ConfirmRestoreDialog onConfirm={confirmRestore} onCancel={cancelRestore} />
      )}
    </div>
  );
}

type ConfirmRestoreDialogProps = {
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * 復元の確認ポップアップ。DayRow の削除確認と同じパターン。
 * - 背景タップ／キャンセルボタン／Escape で閉じる
 * - 「復元」タップで全データ上書き（不可逆）
 */
function ConfirmRestoreDialog({ onConfirm, onCancel }: ConfirmRestoreDialogProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      onClick={onCancel}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
      role="presentation"
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        // biome-ignore lint/a11y/useSemanticElements: <dialog> のネイティブ close 挙動と干渉するためカスタム実装
        role="dialog"
        aria-modal="true"
        aria-label="バックアップから復元"
        className="bg-white rounded-lg shadow-xl px-6 py-5 w-80 max-w-[85%]"
      >
        <p className="text-sm text-neutral-700 mb-4 break-words">
          現在のデータを上書きします。続行しますか？
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 min-h-11 text-sm text-neutral-600 rounded"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 min-h-11 text-sm text-white bg-red-500 rounded active:bg-red-600"
          >
            復元
          </button>
        </div>
      </div>
    </div>
  );
}
