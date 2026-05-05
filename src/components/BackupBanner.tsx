/**
 * B 層：週 1 ファイル書き出しバナー。
 * - 「📦 今週のバックアップを保存」をタップで `<a download>` 発火
 * - iOS Safari の OS 確認バナーを経て Files のダウンロードフォルダへ蓄積される
 * - ✕ で閉じるとセッション中のみ非表示。次回起動時に条件を満たせば再表示
 */
type Props = {
  onSave: () => void;
  onDismiss: () => void;
};

export function BackupBanner({ onSave, onDismiss }: Props) {
  return (
    <section
      aria-label="バックアップのお知らせ"
      className="flex items-center gap-2 px-3 py-2 bg-amber-50 border-b border-amber-200 text-sm"
    >
      <button
        type="button"
        onClick={onSave}
        className="flex-1 min-w-0 truncate text-left text-amber-900 font-medium min-h-11 px-2 active:bg-amber-100 rounded"
      >
        📦 今週のバックアップを保存
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="バナーを閉じる"
        className="w-11 h-11 flex items-center justify-center text-amber-700 active:text-amber-900 shrink-0"
      >
        ×
      </button>
    </section>
  );
}
