import { useEffect, useRef } from "react";
import { useComposition } from "../hooks/useComposition";
import type { EditingTarget } from "../types";

type Props = {
  /** 編集対象。null のときフロート非表示（DONT.md「使わない機能を画面に置かない」原則）。 */
  target: EditingTarget | null;
  /** 対象の現状 text（line.text / memo）。target 切替時に defaultValue として渡される。 */
  currentText: string;
  /** 確定（blur / Enter）。target 種別に応じて updateLineAt / setMemo を親で振り分ける。 */
  onCommit: (text: string) => void;
  /** キャンセル（Escape）。何も反映せず target=null へ。 */
  onCancel: () => void;
  /** 編集中テキストの逐次変化通知（検索ハイライト用）。target.kind === "line" 時のみ親が拾う。 */
  onActiveTextChange?: (text: string) => void;
};

/**
 * 画面上部に sticky で配置する 1 行 input フロート。
 *
 * F011 フロート入力フォーム（SPEC.md 該当セクション参照）：
 * - target が null のときは何も描画しない（DONT 原則）
 * - target セット時に slide-down 200ms で出現、自動 focus
 * - uncontrolled + `key={target 識別子}` 再マウントで IME 多重反映バグを回避（F002 既存対策踏襲）
 * - blur / Enter で onCommit、Escape で onCancel
 * - 外タップでの確定／キャンセルは採用しない（意図不明確な誤確定を避ける）
 *
 * iOS Safari 配慮：
 * - visualViewport API は使わず、`sticky top-0` のままにして virtual keyboard 起動時の挙動を OS デフォルトに任せる
 * - useComposition で IME 中の onChange を抑止し、compositionEnd で確定値を反映
 */
export function FloatingEditor({
  target,
  currentText,
  onCommit,
  onCancel,
  onActiveTextChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const ime = useComposition();
  // target 切替で再マウントするためのキー。kind + dateKey + (lineIndex?) で一意化。
  const targetKey =
    target === null
      ? null
      : target.kind === "line"
        ? `line:${target.dateKey}:${target.lineIndex}`
        : `memo:${target.dateKey}`;

  // target 変化で自動 focus + 検索ハイライト用の activeQuery を同期
  useEffect(() => {
    if (target === null) {
      // 閉時はクリア
      onActiveTextChange?.("");
      return;
    }
    if (inputRef.current) {
      inputRef.current.focus();
      // 末尾にカーソル
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
    if (target.kind === "line") {
      // line target：現状 text を検索ハイライトに送る
      onActiveTextChange?.(inputRef.current?.value ?? "");
    } else {
      // memo target：line 経由で残っていた activeQuery をクリア
      onActiveTextChange?.("");
    }
  }, [target, onActiveTextChange]);

  if (target === null) {
    // 完全非表示（DOM からも消す）。slide アニメは出現時のみ意味があるため、
    // 閉時は単純に非描画で十分。再開時に再マウントされる。
    return null;
  }

  const placeholder = target.kind === "line" ? "料理名" : "メモ";

  return (
    <section
      className="sticky top-0 z-20 bg-white border-b border-neutral-200 shadow-sm px-3 py-2 animate-slide-down"
      aria-label="入力フォーム"
    >
      <input
        ref={inputRef}
        key={targetKey ?? "none"}
        type="text"
        defaultValue={currentText}
        placeholder={placeholder}
        onCompositionStart={ime.onCompositionStart}
        onCompositionEnd={(e) => {
          ime.onCompositionEnd();
          const committed = e.currentTarget.value;
          ime.markCommitted(committed);
          if (target.kind === "line") onActiveTextChange?.(committed);
        }}
        onChange={(e) => {
          if (ime.shouldSkipChange(e.target.value, e.nativeEvent)) return;
          if (target.kind === "line") onActiveTextChange?.(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onCommit(e.currentTarget.value);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={(e) => {
          onCommit(e.currentTarget.value);
        }}
        className="w-full text-base px-2 py-2 rounded border border-neutral-300 bg-white outline-none focus:border-neutral-500 min-h-11"
        aria-label={target.kind === "line" ? "料理名を入力" : "メモを入力"}
      />
    </section>
  );
}
