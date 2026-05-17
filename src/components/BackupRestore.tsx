/**
 * バックアップ復元 UI（2 経路）。
 *
 * 2026-05-17 F007 改訂：
 * - 経路 1: ファイル復元（旧仕様の互換維持）→ `<input type="file">` 経由
 *   ボタン文言は SPEC §「経路 1」定義に合わせ「ファイルから復元」に改名
 * - 経路 2: クリップボード貼り付け復元（新規）→ textarea にユーザーが貼り付け
 *   `navigator.clipboard.readText()` は iOS の「貼り付けますか?」プロンプトが
 *   出るため使わず、textarea 経由の iOS 標準操作に統一する
 *
 * 両経路とも共通の挙動：textarea / file 内容を `pendingText` に保持 → 確認ダイアログ
 *「現在のデータを上書きします。続行しますか？」→ 確定タップで初めて `importFromText` を呼ぶ。
 * 検証失敗時は現データを変更せずインラインエラーを表示する。
 */
import { useEffect, useRef, useState } from "react";
import type { ImportResult } from "../hooks/useBackup";

type Props = {
  importFromText: (text: string) => ImportResult;
};

export function BackupRestore({ importFromText }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");

  // 成功メッセージは 3 秒で自動消滅（再復元時に古い表示が残らないように）
  useEffect(() => {
    if (!successMsg) return;
    const t = window.setTimeout(() => setSuccessMsg(null), 3000);
    return () => window.clearTimeout(t);
  }, [successMsg]);

  function openFileDialog() {
    setError(null);
    fileInputRef.current?.click();
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

  function openPaste() {
    setError(null);
    setPasteOpen(true);
  }

  function cancelPaste() {
    setPasteOpen(false);
    setPasteText("");
  }

  function submitPaste() {
    // SPEC: textarea の内容を pendingText に保持 → 確認ダイアログ経由で初めて importFromText を呼ぶ
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
    <div className="px-1 py-2 text-xs">
      <button
        type="button"
        onClick={openFileDialog}
        className="text-neutral-500 underline active:text-neutral-800 min-h-11 px-2"
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
        className="text-neutral-500 underline active:text-neutral-800 min-h-11 px-2"
      >
        クリップボードから復元
      </button>
      {pasteOpen && (
        <div className="mt-2 flex flex-col gap-2">
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
              className="px-3 py-1 min-h-11 text-sm text-neutral-600 rounded"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={submitPaste}
              className="px-3 py-1 min-h-11 text-sm text-white bg-neutral-800 rounded active:bg-neutral-900"
            >
              復元
            </button>
          </div>
        </div>
      )}
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
