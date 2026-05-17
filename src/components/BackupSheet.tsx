/**
 * F007 バックアップ操作 modal（2026-05-17 改訂2 — popup 化）。
 *
 * SPEC §「エクスポート UI（コピー）」+「復元 UI（2 経路）」より：
 * ストックリスト折りたたみ内に「バックアップ」エントリボタンを 1 個配置し、
 * タップで本 modal を開く。modal 内に下記 3 操作を集約する：
 *   - バックアップをコピー（navigator.clipboard.writeText）
 *   - ファイルから復元（旧 cookpato-backup-*.json 互換）
 *   - クリップボードから復元（textarea 貼り付け経路）
 *
 * 設計判断：
 * - 中央 modal（既存 ConfirmRestoreDialog と同じパターン）。背景タップ / Escape で閉じる
 * - コピー成功 → トースト発火 + modal 自動クローズ（操作完了の合図 + ストック画面に戻す）
 * - コピー失敗 → トースト発火 + modal は開いたままでリトライ可能
 * - 復元（両経路）成功 → modal 内インライン `<output>` 3 秒表示（SPEC §「復元時の共通挙動」維持）
 *   → ユーザーが手動で × を押して閉じる
 * - 復元検証失敗 → インラインエラー、現データは変更しない
 *
 * 確認ダイアログ「現在のデータを上書きします。続行しますか？」は本 modal の上層に
 * 重ねて表示する（z-index 60、本 modal は z-50）。
 */
import { useEffect, useRef, useState } from "react";
import type { CopyResult, ImportResult } from "../hooks/useBackup";
import type { ToastKind } from "./Toast";

const COPY_SUCCESS_TOAST = "コピーしました。Keep メモやメモ帳に貼り付けて保管してください";
const COPY_FAIL_TOAST = "コピーに失敗しました";

type Props = {
  onCopy: () => Promise<CopyResult>;
  importFromText: (text: string) => ImportResult;
  onToast: (message: string, kind: ToastKind) => void;
};

/**
 * ストック折りたたみ内のエントリボタン + modal 本体を統合した単一コンポーネント。
 * modal の開閉 state は本コンポーネントで自己完結する。
 */
export function BackupSheet({ onCopy, importFromText, onToast }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="px-1 py-2 text-xs">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-neutral-500 underline active:text-neutral-800 min-h-11 px-2"
      >
        バックアップ
      </button>
      {open && (
        <BackupModal
          onCopy={onCopy}
          importFromText={importFromText}
          onToast={onToast}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

type ModalProps = {
  onCopy: () => Promise<CopyResult>;
  importFromText: (text: string) => ImportResult;
  onToast: (message: string, kind: ToastKind) => void;
  onClose: () => void;
};

function BackupModal({ onCopy, importFromText, onToast, onClose }: ModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");

  // 成功メッセージは 3 秒で自動消滅
  useEffect(() => {
    if (!successMsg) return;
    const t = window.setTimeout(() => setSuccessMsg(null), 3000);
    return () => window.clearTimeout(t);
  }, [successMsg]);

  // Escape で modal を閉じる（確認ダイアログ open 中は確認側が処理）
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && pendingText === null) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pendingText]);

  async function handleCopy() {
    const result = await onCopy();
    if (result === "ok") {
      onToast(COPY_SUCCESS_TOAST, "info");
      // コピー成功時は modal を閉じてストック画面に戻す（トーストで合図）
      onClose();
    } else {
      onToast(COPY_FAIL_TOAST, "error");
      // 失敗時はリトライしやすいよう modal は開いたまま
    }
  }

  function openFileDialog() {
    setError(null);
    fileInputRef.current?.click();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
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

  function openPaste() {
    setError(null);
    setPasteOpen(true);
  }

  function cancelPaste() {
    setPasteOpen(false);
    setPasteText("");
    setError(null);
  }

  function submitPaste() {
    if (pasteText.trim() === "") {
      setError("貼り付けてください");
      return;
    }
    setPendingText(pasteText);
  }

  function confirmRestore() {
    if (pendingText === null) return;
    const result = importFromText(pendingText);
    setPendingText(null);
    if (result.ok) {
      setError(null);
      setSuccessMsg("バックアップから復元しました");
      setPasteOpen(false);
      setPasteText("");
    } else {
      setError(result.reason);
    }
  }

  function cancelRestore() {
    setPendingText(null);
  }

  return (
    <div
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
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
        aria-label="バックアップ"
        className="bg-white rounded-lg shadow-xl px-5 py-5 w-80 max-w-[85%] text-sm"
      >
        <div className="flex justify-between items-center mb-3">
          <p className="font-bold text-neutral-700">バックアップ</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="text-neutral-500 active:text-neutral-800 min-h-11 min-w-11 -mr-2"
          >
            ×
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-2 min-h-11 rounded bg-neutral-800 text-white active:bg-neutral-900"
          >
            バックアップをコピー
          </button>
          <button
            type="button"
            onClick={openFileDialog}
            className="px-3 py-2 min-h-11 rounded border border-neutral-300 text-neutral-700 active:bg-neutral-100"
          >
            ファイルから復元
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={openPaste}
            className="px-3 py-2 min-h-11 rounded border border-neutral-300 text-neutral-700 active:bg-neutral-100"
          >
            クリップボードから復元
          </button>
        </div>
        {pasteOpen && (
          <div className="mt-3 flex flex-col gap-2">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="ここに貼り付け"
              className="w-full h-32 border border-neutral-300 rounded p-2 text-sm font-mono"
              aria-label="バックアップ JSON 貼り付け"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={cancelPaste}
                className="px-3 py-2 min-h-11 text-neutral-600 rounded"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={submitPaste}
                className="px-3 py-2 min-h-11 text-white bg-neutral-800 rounded active:bg-neutral-900"
              >
                復元
              </button>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-2 text-red-600 text-xs">
            {error}
          </p>
        )}
        {successMsg && (
          <output className="mt-2 block text-emerald-700 text-xs">{successMsg}</output>
        )}
      </div>
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
 * 復元の確認ポップアップ。本 modal の上層（z-60）に重ねて表示する。
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
      className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center"
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
